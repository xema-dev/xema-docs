# Concepts & Fundamentals

> API Docs: https://workflow-engine-api.xema.dev/api/docs

This document explains the core concepts behind Xema Workflows, including the DSL, compilation model, templates, and execution pipeline.

## Table of Contents

1. [What is a Workflow?](#what-is-a-workflow)
2. [The DSL (Domain-Specific Language)](#the-dsl)
3. [Workflow Structure](#workflow-structure)
4. [Compilation Model](#compilation-model)
5. [Templates System](#templates-system)
6. [Phases & Artifacts](#phases--artifacts)
7. [Execution Model](#execution-model)

---

## What is a Workflow?

A **workflow** is a declarative YAML specification that defines an automated process. In Xema, workflows:

- **Are immutable** — Once compiled, a workflow's execution is deterministic
- **Are type-safe** — Inputs, outputs, and actions are validated before execution
- **Run on the Xema Workflow Runtime** — A production-grade distributed workflow engine
- **Support human collaboration** — Approval gates, reviews, and manual interventions
- **Integrate with external systems** — GitHub, GitLab, Jira, Slack, webhooks, etc.

### Example: High-Level Structure

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: my-software-delivery
  version: 1.0.0
on:
  workflow_dispatch:           # Manual trigger
    inputs:
      project_scope:
        type: string
        required: true
jobs:
  analyze:
    uses: xema/agent        # Invoke an agent
    with:
      task: Analyze requirements
  review:
    needs: analyze             # Depends on analyze job
    uses: xema/review       # Draft + review loop
```

---

## The DSL

The Xema Workflow DSL is a **YAML-based, declarative language** for defining automated processes.

### Design Principles

1. **Declarative** — Describe *what* happens, not *how*
2. **Strongly typed** — All inputs, outputs, and parameters are typed
3. **Fail-fast validation** — Invalid workflows are rejected at compile time
4. **Version-pinned** — Actions and resources are referenced with explicit versions
5. **Deterministic** — Same (workflow version + inputs) always produces identical execution

### API Version & Kind

All workflows must declare:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
```

This ensures compatibility with the workflow engine.

### Top-Level Structure

```yaml
metadata:
  name: workflow-name           # Unique within project
  version: 1.0.0               # Semantic versioning
description: Optional description

on:                            # Trigger definitions
  workflow_dispatch: { ... }   # Manual trigger
  schedule: [ { ... } ]        # Cron schedule
  webhook: [ { ... } ]         # External event
  workflow_call: { ... }       # Called by other workflows

concurrency:                   # Concurrency control
  group: string                # Concurrency group
  mode: allow | queue | cancel_in_progress | skip

defaults:                      # Default settings
  retry: { maxAttempts, backoffCoefficient, ... }
  timeout: string              # e.g., "2h"

permissions:                   # What workflows can access
  repos: read | limited | write
  kb: read | limited | write
  backlog: read | limited | write
  artifacts: read | limited | write
  integrations: read | limited | write

vars:                          # Static variables
  key: value

jobs:                          # Parallel/sequential jobs
  job-key: { ... }
```

---

## Workflow Structure

### 1. Metadata

Identifies and versions your workflow:

```yaml
metadata:
  name: requirements-analysis
  version: 2.1.0
description: |
  Automatically analyzes project requirements and generates
  a requirements specification document.
```

### 2. Triggers (on:)

Defines when and how workflows are triggered. There are four trigger types:

#### a. Manual Trigger (`workflow_dispatch`)

Manually triggered by a user or API call:

```yaml
on:
  workflow_dispatch:
    inputs:
      project_scope:
        type: string
        description: "Define the scope of the project"
        required: true
        format: multiline
      include_budget:
        type: boolean
        description: "Include budget analysis?"
        required: false
        defaultValue: false
      priority_level:
        type: string
        enum: [low, medium, high, critical]
        required: true
```

**Input Types**: `string`, `number`, `integer`, `boolean`, `object`, `array`

#### b. Schedule Trigger (`schedule`)

Triggered on a cron schedule:

```yaml
on:
  schedule:
    - cron: "0 9 * * MON"    # Every Monday at 9 AM
      inputs:
        report_type: weekly
    - cron: "0 0 1 * *"       # First day of month at midnight
      inputs:
        report_type: monthly
```

#### c. Webhook Trigger (`webhook`)

Triggered by external events (GitHub push, Jira issue created, etc.):

```yaml
on:
  webhook:
    - event: scm.push           # SCM push event
      filters:
        projectId: proj_123
        branch: main
    - event: scm.pull_request   # SCM pull request
      filters:
        projectId: proj_123
        state: opened
    - event: tracker.issue      # Jira/backlog issue event
      filters:
        projectId: proj_123
```

#### d. Workflow Call Trigger (`workflow_call`)

Called by other workflows:

```yaml
on:
  workflow_call:
    inputs:
      scope:
        type: string
        required: true
    outputs:
      summary:
        value: ${{ needs.final-job.outputs.summary }}
```

### 3. Concurrency Control

Prevents multiple concurrent runs of the same workflow:

```yaml
concurrency:
  group: requirements-for-${{ inputs.project_id }}
  mode: queue  # Options: allow, queue, cancel_in_progress, skip
```

- **allow** — Allow multiple runs simultaneously
- **queue** — Queue runs, execute one at a time
- **cancel_in_progress** — Cancel running workflow, start new one
- **skip** — Skip new trigger while one is running

### 4. Permissions

Declares what resources the workflow can access:

```yaml
permissions:
  repos: read           # Read-only SCM access
  kb: limited          # Limited KB access
  backlog: write       # Full backlog write access
  artifacts: read      # Read-only artifact access
  integrations: read   # Read-only integration access
```

Options: `none`, `read`, `limited`, `write`

### 5. Variables

Static variables available to all jobs:

```yaml
vars:
  organization: "Acme Corp"
  max_iterations: 5
  review_template: "enterprise"
```

Access in jobs: `${{ vars.organization }}`

### 6. Jobs

Jobs are the actual work units. See [Jobs & Execution](#jobs--execution) below.

---

## Jobs & Execution

A **job** is a single unit of work in a workflow. Jobs can run in parallel, in sequence, or with conditional logic.

### Basic Job Structure

```yaml
jobs:
  analyze-requirements:
    title: Analyze Project Requirements
    needs: []                    # Dependencies
    if: ${{ success() }}         # Conditional
    strategy:                    # Matrix/dynamic expansion
      matrix: { ... }
    uses: xema/agent          # Action to run
    with:                        # Inputs to action
      task: Analyze requirements
    outputs:                     # Extract outputs
      summary: ${{ result.summary }}
    timeout: "1h"               # Job timeout
    retry:                       # Retry config
      maxAttempts: 3
      backoffCoefficient: 2.0
```

### Action References

Actions are referenced with `uses`:

```yaml
uses: <namespace>/<action>@<version>
```

Examples:

- `xema/agent` — Invoke an LLM agent
- `xema/review` — Draft + review loop (draft agent → reviewer pool → reject loops back; humans + agents mix)
- `xema/emit-artifact` — Save artifact to store
- `xema/decision-gate` — Decision gate (humans / agents / endpoints, M-of-N policy)
- `software-dev/create-repository` — Create SCM repository

### Job Dependencies

Control execution order using `needs`:

```yaml
jobs:
  step1:
    uses: xema/agent
    with: { task: "Step 1" }

  step2:
    needs: [step1]              # Wait for step1
    uses: xema/agent
    with: { task: "Step 2" }

  step3:
    needs: [step1, step2]       # Wait for both
    uses: xema/agent
    with: { task: "Step 3" }
```

### Conditional Execution

Run jobs conditionally with `if`:

```yaml
jobs:
  build:
    uses: xema/agent
    with: { task: "Build" }

  deploy:
    needs: build
    if: ${{ inputs.deploy == true }}
    uses: xema/agent
    with: { task: "Deploy" }

  notify:
    needs: [build, deploy]
    if: ${{ failure() }}        # Only if previous steps failed
    uses: xema/webhook
```

**Condition Functions**:
- `success()` — Previous job succeeded
- `failure()` — Previous job failed
- `always()` — Always run

### Matrix Expansion

Run a job multiple times with different inputs (**static** or **dynamic**):

#### Static Matrix (Compile-Time)

Defined at workflow authoring time:

```yaml
jobs:
  build-all-platforms:
    strategy:
      matrix:
        os: [ubuntu, windows, macos]
        version: [20, 21, 22]
        architecture: [x86_64, arm64]
      maxParallel: 6           # Limit concurrency
    uses: xema/agent
    with:
      os: ${{ matrix.os }}
      version: ${{ matrix.version }}
      architecture: ${{ matrix.architecture }}
```

This creates 3 × 3 × 2 = 18 parallel jobs.

#### Dynamic Matrix (Runtime)

Expand based on runtime data:

```yaml
jobs:
  discover-services:
    uses: xema/agent
    with:
      task: List all microservices
    outputs:
      services: ${{ result.service_list }}

  deploy-each-service:
    needs: discover-services
    strategy:
      dynamic:
        from: ${{ needs.discover-services.outputs.services }}
        as: service
        maxEntries: 50
    uses: xema/agent
    with:
      service: ${{ dynamic.service }}
```

---

## Compilation Model

### Workflow Lifecycle

```
YAML Workflow Source
       ↓
   Parse & Validate
   (Against JSON schema)
       ↓
   Version-Pin Actions
   (Resolve xema/agent → specific build)
       ↓
   Bind Trigger Inputs
   (Validate against input schema)
       ↓
   Build Job DAG
   (Topological sort)
       ↓
   Evaluate Static Expressions
   (Compile-time constants)
       ↓
   Compute Determinism Hash
   (SHA256 of workflow + inputs)
       ↓
   Emit CompiledRun
   (Immutable execution plan)
       ↓
   Execute on Xema Workflow Runtime
   (Deterministic, repeatable)
```

### Deterministic Compilation

**Key principle**: Same (workflow version + trigger inputs) → same CompiledRun → same execution path.

This ensures:

- **Reproducibility** — Re-run old workflows with same results
- **Auditability** — Complete execution history
- **Safety** — No surprises from runtime re-evaluation

The workflow engine computes a SHA256 hash of:
1. Workflow YAML (version)
2. Trigger inputs (values)
3. Action versions (pinned)

This hash is used to replay workflows or retrieve cached results.

### Validation

Workflows are validated at compile time:

- **Schema validation** — YAML structure matches OpenAPI spec
- **Action existence** — All referenced actions exist and are versioned
- **Type checking** — Input/output types match declarations
- **DAG validation** — No circular dependencies
- **Permission checks** — Actions don't exceed declared permissions

Invalid workflows are **rejected immediately** with clear error messages. No silent failures.

---

## Templates System

Templates enable consistent, reusable workflow and deliverable generation.

### Template Types

#### 1. Prompt Templates (Agent Instructions)

System prompts that guide LLM agents:

```
Template: agents-md.builder
Purpose: Guide an agent to create detailed specifications
Context: role=builder, spec metadata, retry context
Rendered: Markdown with embedded instructions
```

**Key templates**:
- `agents-md.builder` — Create specifications
- `agents-md.gate-reviewer` — Review phase outputs
- `agents-md.clarification-coordinator` — Handle clarifications
- `agents-md.interactive` — Interactive sessions

#### 2. Deliverable Specs Templates

Markdown templates with Handlebars placeholders for specs:

```markdown
# {{projectName}} Requirements Specification

## Overview
{{overview}}

## Functional Requirements
{{#each functionalRequirements}}
- {{this.title}}: {{this.description}}
{{/each}}

## Success Criteria
{{successCriteria}}
```

These templates are:
- **Multi-page** — Complex documents split across files
- **Customizable** — Handlebars helpers for rendering logic
- **Versionable** — Track template changes
- **Scoped** — Different templates for different complexity levels

#### 3. Session Templates

Reusable session configurations:

```json
{
  "name": "requirements-gathering",
  "type": "interactive",
  "tools": ["browser", "code-editor", "diagrams"],
  "context": { "role": "requirements-engineer" }
}
```

### Template Rendering

Templates use **Handlebars** syntax:

```handlebars
{{variable}}              → Replace with value
{{#if condition}}        → Conditional blocks
{{#each array}}          → Loop over array
{{#unless condition}}    → Negation
{{../parent.value}}      → Access parent context
```

Templates are rendered with a **context object** containing:
- Trigger inputs
- Previous job outputs
- Workflow variables
- System variables (time, user, etc.)

---

## Phases & Artifacts

### Pipeline Phases

Xema defines 8 coordinated **phases** in software delivery:

| Phase | Purpose | Output | Execution Model |
|-------|---------|--------|---|
| **Brainstorming** | High-level ideation & scope | brainstorm_output | GLOBAL_SINGLETON |
| **Clarification** | Resolve ambiguities | clarification_report | GLOBAL_SINGLETON |
| **Requirements** | Detailed specifications | requirements_spec | SCOPED_PARALLEL |
| **Architecture** | System design | architecture_spec | SCOPED_PARALLEL |
| **Delivery Planning** | Implementation roadmap | delivery_plan | SCOPED_PARALLEL |
| **Engineering** | Implementation & coding | implementation_report | SCOPED_PARALLEL_WITH_GROUP_MERGE |
| **Governance** | Quality & compliance | governance_report | SCOPED_PARALLEL_WITH_GROUP_MERGE |
| **Deployment** | Release & rollout | deployment_report | GLOBAL_SINGLETON |

### Execution Models

- **GLOBAL_SINGLETON** — Single instance for entire workflow
- **SCOPED_PARALLEL** — Parallel instances per scope (e.g., per service)
- **SCOPED_PARALLEL_WITH_GROUP_MERGE** — Parallel with merge logic

### Artifacts

An **artifact** is a phase-produced deliverable (spec, report, document):

```typescript
interface Artifact {
  id: string
  versionId: string
  version: number
  type: string              // e.g., "requirements_spec"
  pointer: string           // Content-addressed reference
  hash: string
  size: number
  createdAt: string
}
```

Artifacts are:
- **Versioned** — Track all changes
- **Content-addressed** — Retrieved by hash
- **Immutable** — Once created, never modified
- **Referenced** — Accessible to downstream phases

---

## Execution Model

### Xema Workflow Runtime


Workflows execute on the **Xema Workflow Runtime**, a distributed workflow engine providing:

- **Durability** — Workflow state survives process crashes
- **Scaling** — Horizontal scaling via worker pools
- **Reliability** — Automatic retry, timeout handling, deadletter queues
- **History** — Complete execution history and audit trail

### Workflow Execution

```
Xema Workflow Run: rootRunWorkflow
    ├── Job 1 (Activity)
    │   └── Execute action (agent, review, etc.)
    │
    ├── Job 2 (Activity)
    │   └── Execute action
    │
    └── Gate (Child Workflow)
        └── humanApprovalWorkflow
            ├── Wait for decision
            ├── Apply timeout action
            └── Continue or fail
```

### Activities

**Activities** are the executable units in workflows:

- `xema/agent` — Invoke an LLM agent
- `xema/review` — Draft + review loop
- `xema/emit-artifact` — Save artifact
- `xema/decision-gate` — Decision gate
- `xema/webhook` — Send webhook
- `xema/http` — HTTP request
- Domain-specific actions (SCM, backlog, etc.)

### Task Queues

Activities are routed to specific task queues:

- `xema_default` — General activities
- `xema_agent` — Agent invocations (specialized workers)
- `xema_human` — Human approval workflows

---

## Mounts & Filesystem

Workflows have access to a **workspace filesystem** with mounted sources:

### Mount Sources

- **Artifact collections** — Previous workflow artifacts
- **KB spaces** — Knowledge base content
- **SCM repositories** — Git repositories
- **Session attachments** — Files from sessions
- **Deliverable specs** — Template specifications
- **Static literals** — Embedded content

### Access Modes

- **Read-only** — Cannot modify mounted content
- **Read-write** — Can modify (only for writable mounts)

### Example

```yaml
mounts:
  - path: /artifacts
    source:
      kind: artifact-store-collection
      collectionId: coll_123
  - path: /code
    source:
      kind: scm-repo
      repoRef: github.com/acme/myrepo
      ref: main
  - path: /specs
    source:
      kind: deliverable-specs
      contractKey: enterprise-saas
```

---

## Summary

Xema Workflows are built on core concepts:

1. **DSL** — Declarative YAML language
2. **Compilation** — Deterministic, validated, immutable
3. **Templates** — Reusable, customizable specifications
4. **Phases & Artifacts** — Coordinated multi-stage delivery
5. **Execution** — Xema Workflow Runtime-backed, fault-tolerant runtime
6. **Mounts** — Filesystem access to external resources

Together, these enable powerful, flexible, and safe automation of software delivery.

---

**Next**: Read [Features & Capabilities](./features.md) to understand what you can build with these concepts.
