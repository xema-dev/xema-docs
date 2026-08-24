# Expressions & Data Flow

> API Docs: https://workflow-engine-api.xema.dev/api/docs

This document explains how data flows through workflows using inputs, outputs, variables, and expressions.

## Table of Contents

1. [Overview](#overview)
2. [Inputs](#inputs)
3. [Variables](#variables)
4. [Outputs](#outputs)
5. [Expressions Syntax](#expressions-syntax)
6. [Context & Scope](#context--scope)
7. [Common Patterns](#common-patterns)
8. [Type Safety](#type-safety)
9. [Examples](#examples)

---

## Overview

### Data Flow Architecture

```
Workflow Inputs
       ↓
   Trigger Binding
       ↓
   Job Execution
       ├── Access: inputs, vars, needs
       ├── Produce: outputs
       └── Execute: with input expressions
       ↓
   Downstream Jobs
       ├── Access: needs.<job>.outputs
       ├── Conditional: if expressions
       └── Loop: matrix expansion
```

### Three Types of Data

1. **Inputs** — Values passed when workflow is triggered
2. **Variables** — Static values defined in workflow
3. **Outputs** — Values produced by jobs

---

## Inputs

### Declaring Inputs

Inputs are declared in trigger definitions:

```yaml
on:
  workflow_dispatch:
    inputs:
      project_name:
        type: string
        required: true
        description: Name of the project
      budget:
        type: number
        required: false
        defaultValue: 100000
      include_testing:
        type: boolean
        required: false
        defaultValue: true
      priority_level:
        type: string
        enum: [low, medium, high, critical]
        required: true
      team_members:
        type: array
        required: false
        itemType: string
      config:
        type: object
        required: false
```

### Input Types

| Type | Example | Notes |
|------|---------|-------|
| `string` | `"hello"` | Scalar text value |
| `number` | `3.14` | Floating-point number |
| `integer` | `42` | Whole number |
| `boolean` | `true` | true or false |
| `array` | `["a", "b"]` | List of values (must specify `itemType`) |
| `object` | `{key: value}` | JSON object |

### Input String Formats

For `string` type inputs:

```yaml
inputs:
  description:
    type: string
    format: multiline           # Renders as text area in UI
```

### Input Defaults

Provide default values:

```yaml
inputs:
  environment:
    type: string
    defaultValue: staging
    required: false             # Becomes optional if default provided
```

### Input Validation

Inputs can have constraints:

```yaml
inputs:
  region:
    type: string
    enum: [us-west, us-east, eu-west]  # Closed set
    required: true

  priority:
    type: integer
    required: true
```

Invalid inputs are **rejected at dispatch time** with clear error messages.

### Accessing Inputs

In workflow jobs, access inputs via expression:

```yaml
jobs:
  process:
    uses: xema/agent
    with:
      project: ${{ inputs.project_name }}
      budget: ${{ inputs.budget }}
      include_testing: ${{ inputs.include_testing }}
      priority: ${{ inputs.priority_level }}
```

### Example: User Input Validation

```yaml
on:
  workflow_dispatch:
    inputs:
      scope:
        type: string
        enum: [simple, standard, enterprise]
        required: true

jobs:
  start:
    uses: xema/agent
    with:
      message: "Starting workflow for scope: ${{ inputs.scope }}"
```

If user tries to trigger with `scope: advanced` (not in enum), it's rejected before execution.

---

## Variables

### Declaring Variables

Static variables defined at workflow level:

```yaml
vars:
  organization: "Acme Corp"
  max_retries: 3
  review_template: "enterprise"
  documentation_url: "https://docs.acme.com"
```

### Accessing Variables

In workflow jobs:

```yaml
jobs:
  setup:
    uses: xema/agent
    with:
      org: ${{ vars.organization }}
      retries: ${{ vars.max_retries }}
      template: ${{ vars.review_template }}
```

### Advantages Over Hardcoding

- **Centralized** — Single place to update
- **Reusable** — Used across multiple jobs
- **Clear** — Documents workflow configuration
- **Maintainable** — No scattered magic values

---

## Outputs

### Activity outputs

Every activity returns a flat envelope of named outputs. Each declared output is an **artifact reference** (`ArtifactRef`) — never inline content. The reference shape is:

```ts
interface ArtifactRef {
  artifactId: string;
  versionId: string;
  version: number;
  hash: string;
  type: string;     // markdown_doc, json_payload, external_blob, …
  title?: string;
}
```

See [Output Envelope](../deliverables/03-output-envelope.md) for the per-activity output catalogue.

### Declaring job outputs

A job's `outputs:` block selects which activity outputs it re-exports under the job's own namespace. Each entry is an expression — most commonly forwarding an activity output as-is via `job.outputs.<name>`:

```yaml
jobs:
  analyze:
    uses: xema/agent
    with:
      agentRef: requirements
      deliverableSpecRef: risk-assessment
      agentContext:
        prompt: Assess the request and produce the typed risk assessment.
    outputs:
      assessment: ${{ job.outputs.deliverable }}
      artifacts: ${{ job.outputs.deliverables }}
```

### Consuming outputs in downstream jobs

Downstream jobs read job outputs via `needs.<job>.outputs.<name>` and can reach into the `ArtifactRef` fields directly:

```yaml
jobs:
  analyze:
    uses: xema/agent
    with:
      agentRef: requirements
      deliverableSpecRef: risk-assessment
      agentContext:
        prompt: Assess the request and produce the typed risk assessment.
    outputs:
      artifacts: ${{ job.outputs.deliverables }}

  publish:
    needs: [analyze]
    uses: xema/publish-kb
    with:
      spaceSlug: docs
      slug: risk-assessment
      title: Risk assessment
      artifactId: ${{ needs.analyze.outputs.artifacts[0].artifactId }}
      versionId: ${{ needs.analyze.outputs.artifacts[0].versionId }}
      version: ${{ needs.analyze.outputs.artifacts[0].version }}
```

`xema/publish-kb` accepts the `(artifactId, versionId, version)` triple and fetches the bytes from artifact-store — workflow authors never copy bytes between steps.

### Payload Reach-In (Typed)

When an upstream job's output is governed by a **deliverable spec**, you can
reach into the artifact's parsed payload directly from a workflow expression.
The compiler validates the path against the bound spec's schema at compile
time, so a typo on a payload field fails the workflow before any job dispatches.

```yaml
jobs:
  audit:
    uses: xema/agent
    with:
      agentRef: builder@3
      deliverableSpecRef: metrics-snapshot@1.0.0
      agentContext:
        prompt: Produce the current metrics snapshot.

  notify:
    needs: [audit]
    uses: xema/publish-kb@1.0.0
    with:
      space: ops
      slug: coverage
      message: "Coverage: ${{ needs.audit.outputs.report.coverage }}%"
      # `coverage` is a top-level field on `metrics-snapshot@1.0.0` —
      # the compiler validated it; the runtime pre-fetches the payload
      # before this expression evaluates.
```

**How the compiler decides what's typed:**

1. Per-output binding from the upstream activity's `outputBindings:` block —
   strongest signal, wins when present.
2. Falls back to the upstream job's `with.deliverableSpecRef` (for activities
   like the agent action whose spec is workflow-author-chosen).
3. Neither set, AND the field isn't an `ArtifactRef` envelope field
   (`artifactId`, `versionId`, `version`, `hash`, `type`, `title`) →
   `DSL_FIELD_NOT_TYPED` at compile time. Use the `fromJSON(...)` escape
   hatch for ad-hoc payloads, or bind a spec.

**Runtime spec-version assertion:** the workflow runtime fetches each referenced
payload before the expression evaluates, and asserts the producer's
`schemaVersion` matches the spec version the compiler pinned. If a producer
upgrades its emit to a newer spec version while consumers stay compiled
against the older one, the runtime fails fast with a clear spec-drift error
rather than feeding the consumer a payload shape it doesn't expect.

### `fromJSON` / `toJSON`

For payloads without a bound spec, or for ad-hoc parsing of stringly-typed
fields, the DSL exposes GitHub-Actions-style runtime accessors:

| Function | Input | Output |
|---|---|---|
| `fromJSON(ref)` | An `ArtifactRef` from a job output | The fetched, parsed payload |
| `fromJSON(str)` | A JSON string literal | Standard JSON parse result |
| `toJSON(value)` | Anything | JSON-stringified representation |

```yaml
# Runtime parse — works on ArtifactRef or a literal string
- message: ${{ fromJSON(needs.draft.outputs.response).title }}
- payload: ${{ toJSON(needs.draft.outputs.structured) }}
```

The compiler does NOT type-check `fromJSON(...)` arguments — it's the documented
escape hatch when typed reach-in isn't available. Use typed reach-in
(`outputs.<name>.<field>`) when a spec is bound; reach for `fromJSON(...)` only
when one isn't.

### Matrix Job Outputs

When a job has matrix expansion, outputs are available as arrays:

```yaml
jobs:
  build-all:
    strategy:
      matrix:
        os: [ubuntu, windows, macos]
    uses: xema/agent
    with:
      os: ${{ matrix.os }}
    outputs:
      build_id: ${{ result.build_id }}

  collect-builds:
    needs: build-all
    uses: xema/agent
    with:
      # Access all matrix outputs as array
      build_ids: ${{ needs.build-all.outputs }}
```

Or use `matrixGather` to flatten:

```yaml
jobs:
  process-all:
    needs: build-all
    uses: xema/agent
    with:
      all_build_ids: ${{ needs.build-all.outputs.build_id[*] }}
```

### Workflow-Level Outputs

Export outputs from entire workflow (for parent workflows):

```yaml
on:
  workflow_call:
    outputs:
      final_result:
        value: ${{ needs.final-job.outputs.result }}
      artifacts:
        value: ${{ needs.final-job.outputs.artifacts }}
```

---

## Expressions Syntax

### Expression Basics

Expressions are template literals:

```
${{ <expression> }}
```

### Literals

```yaml
${{ 'string' }}              # String literal
${{ 42 }}                    # Number literal
${{ true }}                  # Boolean literal
${{ null }}                  # Null literal
```

### Variable References

```yaml
${{ vars.organization }}
${{ inputs.project_name }}
${{ needs.job1.outputs.summary }}
${{ matrix.os }}
${{ dynamic.service }}
${{ trigger.payload.repo }}
```

### Operators

#### Comparison Operators

```yaml
${{ inputs.budget > 100000 }}
${{ inputs.budget >= 100000 }}
${{ inputs.budget < 50000 }}
${{ inputs.budget <= 50000 }}
${{ inputs.budget == 100000 }}
${{ inputs.budget != 100000 }}
```

#### Logical Operators

```yaml
${{ inputs.deploy && inputs.production }}    # AND
${{ inputs.draft || inputs.publish }}        # OR
${{ !inputs.skip_tests }}                    # NOT
```

#### String Operators

```yaml
${{ 'prefix-' + vars.organization }}         # Concatenation
${{ contains('hello world', 'world') }}      # Contains check
```

### Functions

#### Conditional Functions

- `success()` — Previous job succeeded
- `failure()` — Previous job failed  
- `always()` — Always true (run regardless)

```yaml
jobs:
  test:
    uses: xema/agent

  deploy:
    needs: test
    if: ${{ success() }}         # Only if test succeeded

  notify:
    needs: [test, deploy]
    if: ${{ failure() }}         # Only if any failed

  cleanup:
    needs: [test, deploy]
    if: ${{ always() }}          # Always run
```

#### String Functions

- `contains(string, substring)` — Check substring
- `startsWith(string, prefix)` — Check prefix
- `endsWith(string, suffix)` — Check suffix

```yaml
jobs:
  check-branch:
    needs: previous
    if: ${{ contains(trigger.payload.branch, 'release') }}
    uses: xema/agent

  check-version:
    needs: previous
    if: ${{ startsWith(vars.version, '2.') }}
    uses: xema/agent
```

#### Array Functions

- `length(array)` — Array size
- `first(array)` — First element
- `last(array)` — Last element

```yaml
jobs:
  check-multiple:
    if: ${{ length(needs.previous.outputs.items) > 0 }}
    uses: xema/agent
```

### Object & Array Access

#### Object Property Access

```yaml
# Dot notation
${{ needs.job.outputs.person.name }}

# Bracket notation (for keys with special chars)
${{ needs.job.outputs['config-version'] }}
```

#### Array Element Access

```yaml
${{ needs.job.outputs.items[0] }}            # First element
${{ needs.job.outputs.items[-1] }}           # Last element
```

#### Array Spread

```yaml
# All elements
${{ needs.job.outputs.items[*] }}

# Filter/map operations (not directly supported, use jobs instead)
```

### Escape Characters

Escape special characters:

```yaml
${{ 'string with $ and { special' }}         # In strings
```

For shell commands:

```yaml
with:
  command: 'echo ${{ inputs.text }}'         # Shell will see the value
```

---

## Context & Scope

### Available Contexts

| Context | Availability | Type |
|---------|---|---|
| `inputs` | All jobs | Input values from trigger |
| `vars` | All jobs | Static workflow variables |
| `needs.<job>` | Dependent jobs | Previous job results |
| `matrix.<key>` | Matrix jobs | Current matrix value |
| `dynamic.<key>` | Dynamic jobs | Current dynamic value |
| `trigger` | All jobs | Trigger metadata |
| `xema` | All jobs | Run-level system context (org, project, run, workflow, job, actor) |
| `result` | In outputs | Current job result |

### `xema.*` — system-managed run context

Stable, system-populated fields available in every expression. Reach for
`xema.*` when you want canonical run-level state instead of digging into
trigger metadata.

| Field | Type | Description |
|------|------|-------------|
| `xema.org.id` | string | Owning org id |
| `xema.project.id` | string | Owning project id |
| `xema.run.id` | string | Workflow run id (stable for retries) |
| `xema.run.attempt` | number | Run attempt counter |
| `xema.run.startedAtIso` | string | ISO-8601 timestamp at trigger dispatch |
| `xema.run.correlationId` | string | Cross-service correlation id |
| `xema.run.actor.subject` | string \| null | User id (null for scheduled / webhook) |
| `xema.run.actor.kind` | string | `'user' \| 'system' \| 'webhook' \| 'schedule'` |
| `xema.workflow.key` | string | Workflow slug |
| `xema.workflow.version` | string | Resolved semver |
| `xema.job.key` | string | Current job key |
| `xema.job.attempt` | number | Job attempt counter |

```yaml
# Concurrency keyed off canonical project id
concurrency:
  group: product-development:${{ xema.project.id }}
  mode: queue

# Job that branches on actor kind
jobs:
  audit:
    if: xema.run.actor.kind == 'user'
    uses: ...
```

### Context Examples

```yaml
# In any job
with:
  # Inputs from trigger
  project: ${{ inputs.project_name }}

  # Workflow variables
  org: ${{ vars.organization }}

  # Dependent job outputs
  previous_result: ${{ needs.analyze.outputs.summary }}

  # Matrix values
  os: ${{ matrix.os }}

  # Webhook data
  provider: ${{ trigger.provider }}
  event: ${{ trigger.event }}
```

### Context Hierarchy

```
Workflow Inputs
    ↓
Trigger Payload
    ↓
Job Execution
    ├── Access previous outputs (needs)
    ├── Access matrix values (matrix/dynamic)
    └── Produce new outputs (result)
```

---

## Common Patterns

### Pattern 1: Conditional Deployment

```yaml
jobs:
  build:
    uses: xema/agent
    outputs:
      status: ${{ result.build_status }}

  deploy-prod:
    needs: build
    if: ${{ inputs.environment == 'production' && needs.build.outputs.status == 'success' }}
    uses: xema/agent

  deploy-staging:
    needs: build
    if: ${{ inputs.environment == 'staging' }}
    uses: xema/agent
```

### Pattern 2: Data Transformation Chain

```yaml
jobs:
  fetch-data:
    uses: xema/agent
    outputs:
      raw_data: ${{ result.data }}

  transform:
    needs: fetch-data
    uses: xema/agent
    with:
      input: ${{ needs.fetch-data.outputs.raw_data }}
    outputs:
      transformed: ${{ result.output }}

  validate:
    needs: transform
    uses: xema/agent
    with:
      data: ${{ needs.transform.outputs.transformed }}
```

### Pattern 3: Conditional Matrix Expansion

```yaml
jobs:
  determine-configs:
    uses: xema/agent
    outputs:
      configs: ${{ result.config_list }}

  build-each:
    needs: determine-configs
    strategy:
      dynamic:
        from: ${{ needs.determine-configs.outputs.configs }}
        as: config
    if: ${{ inputs.build_all == true }}
    uses: xema/agent
    with:
      config: ${{ dynamic.config }}
```

### Pattern 4: Aggregating Results

```yaml
jobs:
  process-each:
    strategy:
      matrix:
        item: [a, b, c]
    uses: xema/agent
    outputs:
      result: ${{ result.output }}

  aggregate:
    needs: process-each
    uses: xema/agent
    with:
      # Get all results from matrix jobs
      all_results: ${{ needs.process-each.outputs[*] }}
```

---

## Type Safety

### Type Validation

Input types are validated before execution:

```yaml
on:
  workflow_dispatch:
    inputs:
      count:
        type: integer
        required: true

jobs:
  use-count:
    with:
      count: ${{ inputs.count }}  # Always an integer
```

### Type Conversion

Explicit conversion in expressions:

```yaml
${{ toNumber(inputs.string_number) }}
${{ toString(inputs.number) }}
${{ toJSON(inputs.object) }}
${{ fromJSON(inputs.json_string) }}     # parse a JSON string at runtime
${{ fromJSON(needs.draft.outputs.payload) }}   # parse an ArtifactRef's payload
```

See the [Payload Reach-In](#payload-reach-in-typed) section for how `fromJSON`
interacts with deliverable specs and when to prefer typed reach-in over the
escape hatch.

### Null Safety

Handle missing values:

```yaml
${{ inputs.optional_field || 'default-value' }}
${{ needs.previous.outputs.field || null }}
```

---

## Examples

### Example 1: Multi-Phase Data Flow

```yaml
vars:
  max_scope: enterprise

on:
  workflow_dispatch:
    inputs:
      project_scope:
        type: string
        required: true

jobs:
  requirements:
    uses: xema/agent
    with:
      scope: ${{ inputs.project_scope }}
      template: ${{ vars.max_scope }}
    outputs:
      spec_id: ${{ result.artifact_id }}
      effort_days: ${{ result.effort_days }}

  architecture:
    needs: requirements
    uses: xema/agent
    with:
      requirements_id: ${{ needs.requirements.outputs.spec_id }}
      complexity: ${{ inputs.project_scope }}
    outputs:
      design_id: ${{ result.artifact_id }}

  estimate:
    needs: [requirements, architecture]
    uses: xema/agent
    with:
      requirements_effort: ${{ needs.requirements.outputs.effort_days }}
      design_id: ${{ needs.architecture.outputs.design_id }}
```

### Example 2: Webhook Trigger with Expressions

```yaml
on:
  webhook:
    - event: scm.pull_request

jobs:
  analyze:
    if: ${{ trigger.payload.pull_request.state == 'opened' }}
    uses: xema/agent
    with:
      pr_title: ${{ trigger.payload.pull_request.title }}
      changed_files: ${{ trigger.payload.pull_request.files_changed }}
    outputs:
      review_status: ${{ result.status }}

  post-review:
    needs: analyze
    if: ${{ needs.analyze.outputs.review_status == 'approved' }}
    uses: xema/webhook
    with:
      url: ${{ trigger.payload.pull_request.comments_url }}
      body:
        status: approved
```

### Example 3: Matrix with Conditional Output Processing

```yaml
jobs:
  test-all:
    strategy:
      matrix:
        version: [18, 20, 22]
    uses: xema/agent
    with:
      node_version: ${{ matrix.version }}
    outputs:
      status: ${{ result.status }}

  report:
    needs: test-all
    uses: xema/agent
    with:
      all_statuses: ${{ needs.test-all.outputs[*] }}
      success_count: ${{ length(filter(needs.test-all.outputs, 'success')) }}
```

---

**Next**: Read [Templates System](./06-templates-guide.md) for details on template customization.
