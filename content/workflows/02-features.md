# Features & Capabilities

> API Docs: https://workflow-engine-api.xema.dev/api/docs

This document outlines all major features available in Xema Workflows and when to use them.

## Table of Contents

1. [Multi-Phase Pipelines](#multi-phase-pipelines)
2. [Intelligent Execution](#intelligent-execution)
3. [Human Collaboration](#human-collaboration)
4. [Dynamic Job Expansion](#dynamic-job-expansion)
5. [Data Flow & Expressions](#data-flow--expressions)
6. [Error Handling & Retry](#error-handling--retry)
7. [Concurrency Control](#concurrency-control)
8. [Timeouts & Deadlines](#timeouts--deadlines)
9. [Conditional Execution](#conditional-execution)
10. [Artifact Management](#artifact-management)
11. [Webhooks & External Triggers](#webhooks--external-triggers)
12. [Permission-Based Access Control](#permission-based-access-control)

---

## Multi-Phase Pipelines

### What It Is

Workflows orchestrate software delivery across **8 coordinated phases**:

1. **Brainstorming** — Initial ideation and scope definition
2. **Clarification** — Resolve ambiguities and questions
3. **Requirements** — Detailed specifications
4. **Architecture** — System design and technical approach
5. **Delivery Planning** — Implementation roadmap
6. **Engineering** — Development and coding
7. **Governance** — Quality assurance and compliance
8. **Deployment** — Release and rollout

### How It Works

Each phase:
- **Produces artifacts** — Specifications, reports, documentation
- **Has its own gate** — Automated review + optional human approval
- **Runs in parallel or serial** — Based on execution model
- **Feeds downstream phases** — Artifacts become input to next phase

### Example Use Case

```yaml
jobs:
  brainstorm:
    uses: xema/agent
    with:
      task: Brainstorm project goals and scope

  draft-requirements:
    needs: brainstorm
    uses: xema/agent
    with:
      task: Create detailed requirements specification
      context: ${{ needs.brainstorm.outputs.response }}

  requirements:
    needs: [draft-requirements]
    uses: xema/review
    with:
      reviewId: ${{ format('{0}:requirements', trigger.correlationId) }}
      # External authoring shape: the producer is a separate step, the
      # review references it via `subject` + `redraft.step`. On reject,
      # the engine re-dispatches `draft-requirements` with the prior
      # reviewer feedback merged into `agentContext.review`.
      subject: ${{ needs.draft-requirements.outputs.deliverables }}
      redraft: { step: draft-requirements }
      reviewers:
        # Mixed pool: a quality-checker agent (mandatory, demoted to
        # advisory after 3 rejects) and a human (always mandatory).
        - kind: agent
          target: { agentRef: gate-reviewer-quality }
          mandatory: true
          agentMaxIterations: 3
        - kind: human
          target: { userId: ${{ trigger.actorSubject }} }
          mandatory: true
      policy:
        kind: all_of
      iterationTimeoutSeconds: 86400
      onIterationTimeout: reject
```

### When to Use

- Building complex software projects with multiple stakeholders
- Need clear handoffs between roles (designers → architects → engineers)
- Want automated quality gates at each stage
- Track deliverables and maintain audit trail

---

## Intelligent Execution

### What It Is

Workflows can invoke **LLM agents** to automate intelligent tasks:

- Analyze requirements
- Generate specifications
- Review code
- Answer questions
- Extract information
- Generate reports

### How It Works

```yaml
jobs:
  analyze-requirements:
    uses: xema/agent
    with:
      task: "Analyze the provided requirements and identify gaps"
      context: ${{ vars.project_context }}
      tools: [code-editor, browser]      # Tools available to agent
      mounts:                            # Files agent can access
        /context: knowledge-base
        /code: repository
      temperature: 0.7                   # Creativity level (0.0 = deterministic)
      maxIterations: 10                  # Max reasoning steps
```

### Agent Capabilities

Agents have access to:

- **Tools** — Code editor, browser, file system, diagrams
- **Mounts** — Read/write access to knowledge base, repositories, artifacts
- **Context** — Previous artifacts, specifications, instructions
- **Memory** — Multi-turn conversation history
- **Reasoning** — Step-by-step problem-solving

### When to Use

- Automating complex analysis tasks
- Generating specifications from high-level requirements
- Code review and quality analysis
- Knowledge extraction and synthesis
- Report generation

---

## Human Collaboration

### What It Is

Workflows can pause and wait for **human decisions**:

- Approval gates before proceeding
- Manual reviews with feedback
- Clarification rounds with questions
- Voting/quorum-based decisions

### Decision Gates

```yaml
jobs:
  requirements-gate:
    needs: requirements
    uses: xema/decision-gate
    with:
      title: Approve requirements
      subjectArtifacts: ${{ needs.requirements.outputs }}
      timeoutSeconds: 604800       # 7 days
      onTimeout: reject            # approve | reject
      recipients:
        - kind: human
          target: { userId: alice@acme.com }
        - kind: human
          target: { userId: bob@acme.com }
      policy:
        kind: m_of_n
        m: 1                       # 1 of 2 approvals satisfies the gate
```

Gates accept three recipient kinds — `human`, `agent` (an LLM-driven decider),
and `endpoint` (an HTTP check) — in any combination. The reply policy is
one of `single`, `m_of_n`, `all_of`, or `any_of`.

### Approval Decisions

Each reviewer can:
- **Approve** — Proceed to next phase
- **Reject** — Return to previous phase with feedback
- **Force Approve** — Override and proceed (special permission)

### Interactive Sessions

Interactive Q&A with users runs through `xema/agent` — the agent
asks clarification questions via inquiries, the user replies, the
agent drafts:

```yaml
jobs:
  clarification-round:
    uses: xema/agent
    with:
      agentSlug: clarification-coordinator
      role: coordinator
      agentSession: true
      agentContext:
        purpose: Clarify project requirements
        context: ${{ needs.brainstorm.outputs.response }}
```

Participants can:
- Ask questions
- Provide feedback
- Modify documents in real-time
- Upload files/attachments

### When to Use

- Require stakeholder sign-off before proceeding
- Need back-and-forth clarification
- Want voting/consensus decisions
- Track approval history and reasoning

---

## Dynamic Job Expansion

### What It Is

**Matrix expansion** runs a job multiple times with different parameters:

- **Static matrices** — Defined at workflow authoring time
- **Dynamic matrices** — Determined at runtime based on data

### Static Matrix

Known at workflow creation:

```yaml
jobs:
  test-all-platforms:
    strategy:
      matrix:
        os: [ubuntu-22.04, windows-2022, macos-13]
        python-version: [3.10, 3.11, 3.12]
        include:
          - os: ubuntu-22.04
            python-version: "3.13"  # Test 3.13 only on Ubuntu
      maxParallel: 4                 # Limit concurrent jobs
    uses: xema/agent
    with:
      test-suite: "all"
      os: ${{ matrix.os }}
      python-version: ${{ matrix.python-version }}
```

Creates 3 × 3 = 9 jobs (or more with `include`).

### Dynamic Matrix

Unknown until runtime:

```yaml
jobs:
  discover-microservices:
    uses: xema/agent
    with:
      task: List all microservices in the project
    outputs:
      services: ${{ result.service_list }}

  deploy-each-service:
    needs: discover-microservices
    strategy:
      dynamic:
        from: ${{ needs.discover-microservices.outputs.services }}
        as: service
        maxEntries: 100              # Prevent runaway expansion
    uses: xema/agent
    with:
      service: ${{ dynamic.service }}
      action: deploy
```

Number of jobs determined at runtime.

### Accessing Matrix Values

In job with matrix expansion:

```yaml
with:
  os: ${{ matrix.os }}
  version: ${{ matrix.version }}
  # Access previous job matrix values:
  previous_platforms: ${{ needs.build.outputs }}
```

### When to Use

- Test across multiple platforms/configurations
- Deploy to multiple regions or environments
- Process multiple items in parallel
- Scale workflows based on runtime discovery

---

## Data Flow & Expressions

### What It Is

Workflows pass data between jobs using:

- **Inputs** — Trigger parameters
- **Outputs** — Job results
- **Expressions** — Template logic

### Inputs

Typed, validated trigger inputs:

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
```

Access inputs: `${{ inputs.project_name }}`

### Outputs

Extract data from job results:

```yaml
jobs:
  analyze:
    uses: xema/agent
    with: { task: Analyze }
    outputs:
      summary: ${{ result.summary }}
      risks: ${{ result.risks }}
      budget: ${{ result.budget }}

  report:
    needs: analyze
    uses: xema/agent
    with:
      summary: ${{ needs.analyze.outputs.summary }}
      risks: ${{ needs.analyze.outputs.risks }}
```

### Expressions

Template syntax for dynamic values:

```yaml
${{ expression }}
```

**Expression Features**:

- **Variable access** — `vars.org_name`, `inputs.scope`, `needs.job.outputs.field`
- **Literals** — `'string'`, `42`, `true`, `null`
- **Operators** — `==`, `!=`, `<`, `>`, `<=`, `>=`, `&&`, `||`, `!`
- **Functions** — `success()`, `failure()`, `always()`, `contains(string, substring)`
- **Array access** — `array[0]`, `array[*]` (all elements)
- **Object access** — `object.field`, `object['field-name']`

### Example Data Flow

```yaml
vars:
  organization: "Acme Corp"

on:
  workflow_dispatch:
    inputs:
      project_scope: { type: string, required: true }

jobs:
  analyze:
    uses: xema/agent
    with:
      org: ${{ vars.organization }}
      scope: ${{ inputs.project_scope }}
    outputs:
      risks: ${{ result.identified_risks }}

  assess-risks:
    needs: analyze
    if: ${{ contains(needs.analyze.outputs.risks, 'high') }}
    uses: xema/agent
    with:
      risks: ${{ needs.analyze.outputs.risks }}
      risk_level: high
```

### When to Use

- Pass data between workflow jobs
- Conditionally execute based on previous results
- Build dynamic parameters
- Construct complex logic

---

## Error Handling & Retry

### What It Is

Built-in automatic retry and failure handling:

- Automatic retries with exponential backoff
- Customizable retry policies
- Fallback actions
- Error notification

### Retry Policy

```yaml
defaults:
  retry:
    maxAttempts: 3
    backoffCoefficient: 2.0        # 1s, 2s, 4s, 8s...
    initialInterval: 1s
    maxInterval: 60s

jobs:
  deploy:
    retry:
      maxAttempts: 5               # Override default
      backoffCoefficient: 1.5
    uses: xema/agent
```

### Failure Handling

```yaml
jobs:
  primary:
    uses: xema/agent
    with: { task: Primary task }

  on-failure:
    needs: primary
    if: ${{ failure() }}
    uses: xema/webhook          # Notify on failure
    with:
      url: https://alerts.acme.com/slack
      message: "Primary task failed"
      severity: critical
```

### When to Use

- Transient errors (network timeouts, rate limits)
- Long-running operations that may fail temporarily
- Gradual rollouts (retry with exponential backoff)
- Alert on persistent failures

---

## Concurrency Control

### What It Is

Prevent multiple workflows from running simultaneously:

- Queue runs sequentially
- Cancel old runs when new ones trigger
- Skip duplicate triggers

### Configuration

```yaml
concurrency:
  group: requirements-for-project-${{ inputs.project_id }}
  mode: queue                      # allow | queue | cancel_in_progress | skip
```

### Modes

- **allow** — Multiple concurrent runs (default)
- **queue** — Run one at a time, queue new triggers
- **cancel_in_progress** — Cancel running workflow, start new one
- **skip** — Skip if another is running

### Example

Project with requirement updates:

```yaml
concurrency:
  group: requirements-${{ inputs.project_id }}
  mode: queue                      # Process one at a time
```

If users trigger the workflow 3 times in succession, they'll execute in order: 1 → 2 → 3.

### When to Use

- Prevent race conditions (data corruption, duplicate processing)
- Enforce single-threaded execution for critical resources
- Queue-based processing model

---

## Timeouts & Deadlines

### What It Is

Automatic timeout of jobs and entire workflows:

- Per-job timeout
- Workflow-level timeout
- Timeout actions (fail, retry, escalate)

### Configuration

```yaml
defaults:
  timeout: "24h"                   # Workflow level

jobs:
  quick-task:
    timeout: "5m"
    uses: xema/agent

  long-task:
    timeout: "2h"
    uses: xema/agent

  approval:
    uses: xema/decision-gate
    with:
      title: Final approval
      timeoutSeconds: 604800       # 7 days
      onTimeout: reject            # approve | reject
      recipients:
        - kind: human
          target: { userId: ${{ trigger.actorSubject }} }
      policy:
        kind: single
```

### When to Use

- Prevent workflows from hanging indefinitely
- Long-running tasks need explicit timeout
- Human approvals need deadline pressure
- Long-wait operations need failure detection

---

## Conditional Execution

### What It Is

Run jobs only if conditions are met:

- Based on previous job results
- Based on input values
- Based on expressions

### Condition Functions

- `success()` — Previous job(s) succeeded
- `failure()` — Previous job(s) failed
- `always()` — Always run regardless

### Examples

```yaml
jobs:
  build:
    uses: xema/agent
    with: { task: Build }

  test:
    needs: build
    if: ${{ success() }}            # Run only if build succeeded
    uses: xema/agent
    with: { task: Test }

  deploy-prod:
    needs: test
    if: ${{ inputs.environment == 'production' }}
    uses: xema/agent
    with: { task: Deploy to production }

  notify-failure:
    needs: [build, test, deploy-prod]
    if: ${{ failure() }}            # Run if any previous job failed
    uses: xema/webhook
```

### When to Use

- Different paths for different inputs
- Skip deployment if tests fail
- Conditional cleanup/rollback
- Environment-specific workflows

---

## Artifact Management

### What It Is

Store, version, and reference **deliverables** (specs, reports, documents):

- Immutable versioning
- Content-addressed (by hash)
- Reference in downstream workflows
- Full audit trail

### Emitting Artifacts

```yaml
jobs:
  create-spec:
    uses: xema/agent
    with: { task: Create specification }
    outputs:
      spec_id: ${{ result.artifact_id }}

  save-spec:
    needs: create-spec
    uses: xema/emit-artifact
    with:
      type: requirements_spec
      content: ${{ needs.create-spec.outputs.content }}
      metadata:
        phase: requirements
        project_id: ${{ inputs.project_id }}
    outputs:
      artifact_id: ${{ result.artifactId }}
      version: ${{ result.version }}
```

### Referencing Artifacts

Access previous artifacts in new workflows:

```yaml
mounts:
  - path: /previous-specs
    source:
      kind: artifact-store-collection
      collectionId: ${{ inputs.collection_id }}

jobs:
  next-phase:
    uses: xema/agent
    with:
      task: Based on previous spec, create architecture
      spec_path: /previous-specs
```

### When to Use

- Track deliverables across phases
- Versioning and audit trail
- Reuse previous work in new phases
- Feed downstream workflows

---

## Webhooks & External Triggers

### What It Is

Trigger workflows from external systems:

- GitHub pushes, PRs, releases
- GitLab pushes, merge requests
- Jira issue creation/updates
- Custom webhooks
- Scheduled triggers (cron)

### Webhook Triggers

```yaml
on:
  webhook:
    - event: scm.push
      filters:
        branch: main
        projectId: proj_123
    - event: scm.pull_request
      filters:
        state: opened
    - event: tracker.issue
      filters:
        type: feature
```

### Scheduled Triggers

```yaml
on:
  schedule:
    - cron: "0 9 * * MON"          # Every Monday 9 AM
      inputs:
        report_type: weekly
    - cron: "0 0 1 * *"             # First day of month
      inputs:
        report_type: monthly
```

### Trigger Payload Access

```yaml
jobs:
  process-event:
    uses: xema/agent
    with:
      provider: ${{ trigger.provider }}      # e.g., "github"
      event: ${{ trigger.event }}            # e.g., "scm.push"
      repo: ${{ trigger.payload.repo }}
      branch: ${{ trigger.payload.branch }}
      commit: ${{ trigger.payload.commit }}
```

### When to Use

- React to code changes automatically
- Trigger on external events
- Periodic reports or maintenance
- Integration with existing tools

---

## Permission-Based Access Control

### What It Is

Workflows declare what resources they can access:

- Prevents privilege escalation
- Clear audit trail
- Security boundary

### Permission Scopes

```yaml
permissions:
  repos: read                      # SCM access level
  kb: limited                      # Knowledge base access
  backlog: write                   # Issue tracking access
  artifacts: read                  # Artifact store access
  integrations: read               # External integration access
```

### Levels

- **none** — No access
- **read** — Read-only access
- **limited** — Restricted access (read + specific operations)
- **write** — Full read/write access

### When to Use

- Enforce security policies
- Prevent accidental data corruption
- Compliance and audit requirements
- Role-based access control

---

## Feature Combinations

### Example: Complex Approval Workflow

```yaml
on:
  workflow_dispatch:
    inputs:
      scope: { type: string, required: true }

concurrency:
  group: requirements-for-${{ inputs.scope }}
  mode: queue

permissions:
  kb: write
  artifacts: write

jobs:
  draft:
    uses: xema/agent
    with:
      task: Draft requirements
      scope: ${{ inputs.scope }}
    outputs:
      draft_id: ${{ result.artifact_id }}

  technical-review:
    needs: draft
    if: ${{ inputs.scope != 'simple' }}
    uses: xema/decision-gate
    with:
      title: Technical review
      subjectArtifacts: ${{ needs.draft.outputs }}
      timeoutSeconds: 259200       # 3 days
      onTimeout: reject
      recipients:
        - kind: human
          target: { userId: tech-leads }
      policy:
        kind: single

  pm-review:
    needs: [draft, technical-review]
    if: ${{ success() || failure() }}  # Always review
    uses: xema/decision-gate
    with:
      title: Product review
      subjectArtifacts: ${{ needs.draft.outputs }}
      timeoutSeconds: 172800       # 2 days
      onTimeout: reject
      recipients:
        - kind: human
          target: { userId: alice@acme.com }
        - kind: human
          target: { userId: bob@acme.com }
      policy:
        kind: m_of_n
        m: 2
      timeout: "2 days"

  publish:
    needs: pm-review
    if: ${{ success() }}
    uses: xema/emit-artifact
    with:
      type: requirements_spec
      content: ${{ needs.draft.outputs.content }}
```

---

## Summary

Xema Workflows provide a comprehensive feature set for:

✅ Multi-phase orchestration  
✅ Intelligent automation (agents)  
✅ Human collaboration (approvals, reviews)  
✅ Dynamic expansion (matrix, dynamic jobs)  
✅ Type-safe data flow (inputs, outputs, expressions)  
✅ Error handling (retry, timeout, failure handling)  
✅ Concurrency control (queue, cancel, skip)  
✅ Conditional execution (if/then logic)  
✅ Artifact management (versioning, audit trail)  
✅ External integration (webhooks, schedules)  
✅ Security (permissions, access control)  

---

**Next**: Read [Integration Guide](./05-integration-guide.md) to understand how external systems interact with workflows.
