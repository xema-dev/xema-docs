# Workflow Triggers

> API Docs: https://workflow-engine-api.xema.dev/api/docs
> Integration API Docs: https://integration-adapters-api.xema.dev/api/docs

Workflows are started by **triggers** — events or actions that initiate a workflow run. Xema supports four trigger types, each designed for a different use case.

## Trigger Types

| Type | When to Use |
|------|-------------|
| [`workflow_dispatch`](#workflow_dispatch--manual) | Manual start with explicit inputs |
| [`schedule`](#schedule--time-based) | Time-based, recurring automation |
| [`webhook`](#webhook--event-driven) | Respond to external system events (GitHub, Jira, Slack, etc.) |
| [`workflow_call`](#workflow_call--sub-workflows) | Called by another workflow as a reusable sub-workflow |

A single workflow can declare **multiple trigger types** simultaneously:

```yaml
on:
  workflow_dispatch:
    inputs:
      ...
  schedule:
    - cron: "0 9 * * MON"
  webhook:
    - event: scm.push
```

When triggered, each run carries a **trigger payload** that tells jobs how the workflow was started and what data it carries. You access this via the `${{ trigger.* }}` context.

---

## `workflow_dispatch` — Manual

The most straightforward trigger: a human or automated system manually starts the workflow with explicit input values.

### Syntax

```yaml
on:
  workflow_dispatch:
    inputs:
      project_name:
        type: string
        required: true
        description: The name of the project
      budget:
        type: number
        required: false
        defaultValue: 100000
      include_testing:
        type: boolean
        required: false
        defaultValue: true
      priority:
        type: string
        enum: [low, medium, high, critical]
        required: true
      tags:
        type: array
        required: false
```

### Input Types

| Type | Description | Notes |
|------|-------------|-------|
| `string` | Text value | Can use `enum` to restrict values |
| `number` | Floating-point number | |
| `integer` | Whole number | |
| `boolean` | `true` or `false` | |
| `object` | JSON object | |
| `array` | JSON array | Can define `items` schema |

### Enum (Closed Sets)

Use `enum` to restrict a string input to a specific set of values:

```yaml
priority:
  type: string
  enum: [low, medium, high, critical]
  required: true
```

This is validated at dispatch time. Any value outside the enum is rejected.

### Dispatching via API

```bash
curl -X POST https://workflow-engine-api.xema.dev/workflows/{slug}/dispatch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowSlug": "requirements-analysis",
    "version": "1.0.0",
    "inputs": {
      "project_name": "Acme Platform",
      "budget": 250000,
      "include_testing": true,
      "priority": "high"
    }
  }'
```

If `version` is omitted, the latest published version is used.

### Accessing Inputs in Jobs

```yaml
jobs:
  analyze:
    uses: xema/agent
    with:
      project: ${{ inputs.project_name }}
      budget: ${{ inputs.budget }}
      priority: ${{ inputs.priority }}
```

### Trigger Context

```yaml
${{ inputs.project_name }}   # Input value
${{ trigger.kind }}          # "workflow_dispatch"
${{ trigger.correlationId }} # Unique run correlation ID
```

---

## `schedule` — Time-Based

Schedule workflows to run automatically at specific times using cron syntax.

### Syntax

```yaml
on:
  schedule:
    - cron: "0 9 * * MON"
      timezone: "America/New_York"
      inputs:
        report_type: weekly
    - cron: "0 0 1 * *"
      inputs:
        report_type: monthly
```

Multiple schedules can be declared — each fires independently.

### Cron Format

```
┌───── minute (0–59)
│ ┌───── hour (0–23)
│ │ ┌───── day of month (1–31)
│ │ │ ┌───── month (1–12)
│ │ │ │ ┌───── day of week (0=Sunday, 1=Monday, ... 7=Sunday)
│ │ │ │ │
* * * * *
```

### Common Cron Examples

| Schedule | Expression |
|----------|-----------|
| Every minute | `* * * * *` |
| Every 15 minutes | `*/15 * * * *` |
| Every hour | `0 * * * *` |
| Daily at midnight (UTC) | `0 0 * * *` |
| Daily at 9 AM | `0 9 * * *` |
| Weekdays at 9 AM | `0 9 * * 1-5` |
| Monday at 9 AM | `0 9 * * MON` |
| First day of month | `0 0 1 * *` |
| First Monday of month | `0 0 * * 1#1` |

### Timezone

By default, cron times are evaluated in **UTC**. Specify a timezone to use local time:

```yaml
- cron: "0 9 * * MON"
  timezone: "America/New_York"   # 9 AM New York time
```

Valid timezone names follow the IANA timezone database (e.g., `Europe/London`, `Asia/Tokyo`, `America/Sao_Paulo`).

### Inputs on Schedules

Schedule inputs are validated against the workflow's `workflow_dispatch.inputs` schema. This means a workflow can be triggered **both manually and on a schedule**, sharing the same input declarations:

```yaml
on:
  workflow_dispatch:
    inputs:
      report_type:
        type: string
        enum: [daily, weekly, monthly]
        required: true
  schedule:
    - cron: "0 9 * * MON"
      inputs:
        report_type: weekly       # Pre-bound, validated against dispatch schema
    - cron: "0 0 1 * *"
      inputs:
        report_type: monthly
```

### Managing Schedules via API

```bash
# List schedules for a workflow
curl "https://workflow-engine-api.xema.dev/schedules?workflowSlug=weekly-report" \
  -H "Authorization: Bearer $TOKEN"

# Create a new schedule
curl -X POST "https://workflow-engine-api.xema.dev/schedules" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "workflowSlug": "weekly-report",
    "cronSpec": "0 9 * * FRI",
    "timezone": "UTC",
    "inputs": {"report_type": "weekly"}
  }'

# Pause a schedule
curl -X PATCH "https://workflow-engine-api.xema.dev/schedules/{id}" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"state": "paused"}'

# Resume a schedule
curl -X PATCH "https://workflow-engine-api.xema.dev/schedules/{id}" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"state": "active"}'

# Delete a schedule
curl -X DELETE "https://workflow-engine-api.xema.dev/schedules/{id}" \
  -H "Authorization: Bearer $TOKEN"
```

### Trigger Context

```yaml
${{ trigger.kind }}        # "schedule"
${{ trigger.cronSpec }}    # "0 9 * * MON" — the cron that fired
${{ trigger.scheduleId }}  # Internal schedule ID
${{ inputs.report_type }}  # Pre-bound input values
```

### Example: Weekly Report with Multiple Schedules

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: automated-reporting
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      report_type:
        type: string
        enum: [daily, weekly, monthly, quarterly]
        required: true
      recipients:
        type: array
        required: false
  schedule:
    - cron: "0 8 * * *"
      timezone: "UTC"
      inputs:
        report_type: daily
    - cron: "0 8 * * MON"
      timezone: "UTC"
      inputs:
        report_type: weekly
    - cron: "0 8 1 * *"
      timezone: "UTC"
      inputs:
        report_type: monthly
    - cron: "0 8 1 1,4,7,10 *"
      inputs:
        report_type: quarterly

concurrency:
  group: reporting-${{ inputs.report_type }}
  mode: skip                # Skip if same report type already running

jobs:
  generate-report:
    uses: xema/agent
    with:
      report_type: ${{ inputs.report_type }}
      trigger_kind: ${{ trigger.kind }}
      task: Generate ${{ inputs.report_type }} report
    outputs:
      report_id: ${{ result.artifact_id }}

  send-report:
    needs: generate-report
    uses: xema/webhook
    with:
      url: https://api.acme.com/reports/send
      payload:
        report_id: ${{ needs.generate-report.outputs.report_id }}
        report_type: ${{ inputs.report_type }}
```

---

## `webhook` — Event-Driven

Trigger workflows in response to events from external systems — GitHub pushes, Jira issues, Slack messages, and more.

### Syntax

```yaml
on:
  webhook:
    - event: scm.push
      filters:
        branch: main
    - event: scm.pull_request
      filters:
        state: opened
        targetBranch: main
    - event: tracker.issue
      filters:
        type: feature
        priority: [high, critical]
```

Multiple webhook subscriptions can be declared. Each fires independently.

### How Webhooks Flow

```
External Provider (GitHub, Jira, Slack, …)
  → POST /webhooks to integration-adapters-api
  → Adapter normalizes to canonical envelope
  → Forward to workflow-engine-api
  → Engine matches event type + filters
  → Dispatch matching workflows
```

All external webhooks are **normalized** by the integration adapter before reaching your workflow. This means you work with consistent payload shapes regardless of provider.

### Supported Events

#### SCM (Source Code Management)

| Event | When Fired |
|-------|-----------|
| `scm.push` | Code pushed to a branch |
| `scm.pull_request` | PR opened, updated, or closed |

**Common filters**: `branch`, `targetBranch`, `state`, `repository.fullName`

#### Tracker (Issue Tracking)

| Event | When Fired |
|-------|-----------|
| `tracker.issue` | Issue created or updated |

**Common filters**: `type`, `priority`, `status`, `assignee`

#### Documentation

| Event | When Fired |
|-------|-----------|
| `doc.page` | Documentation page published or updated |

### Webhook Filters

Filters let you narrow which events trigger your workflow:

```yaml
on:
  webhook:
    - event: scm.push
      filters:
        branch: main                    # Exact string match
    - event: tracker.issue
      filters:
        priority: [high, critical]      # Array = any of these values
    - event: scm.pull_request
      filters: {}                       # Empty = match all events of this type
```

**Filter matching rules:**
- String value → exact match required
- Array value → event field must match **any** of the array values
- Empty filters `{}` → match all events of this type
- Missing filters key → not checked (matches)

### Trigger Context

The webhook payload is available via `trigger.*`:

```yaml
# Common trigger fields
${{ trigger.kind }}                      # "webhook"
${{ trigger.event }}                     # "scm.push"
${{ trigger.provider }}                  # "github"
${{ trigger.deliveryId }}               # Unique delivery ID (for idempotency)

# Provider payload
${{ trigger.payload.repository.fullName }}  # e.g., "acme/my-repo"
${{ trigger.payload.pull_request.number }}  # PR number
${{ trigger.payload.issue.key }}            # Jira issue key
${{ trigger.payload.pull_request.title }}   # PR title
${{ trigger.payload.branch }}               # Branch name
${{ trigger.payload.commit.sha }}           # Commit SHA
```

### Configuring Webhook Sources

External webhooks are configured per-integration in the Integration Adapters service. Each integration subscribes a specific provider and routes normalized events to the workflow engine.

See [Integration Guide](/docs/workflows/integration-guide.md) for provider setup instructions.

### Example: GitHub PR Auto-Review

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: pr-auto-review
  version: 1.0.0

on:
  webhook:
    - event: scm.pull_request
      filters:
        state: opened
        targetBranch: main

jobs:
  review-pr:
    uses: xema/agent
    with:
      task: Review pull request code quality
      title: ${{ trigger.payload.pull_request.title }}
      branch: ${{ trigger.payload.pull_request.branch }}
      diff: ${{ trigger.payload.pull_request.diff }}
    outputs:
      review: ${{ result.review }}
      approved: ${{ result.approved }}

  post-review:
    needs: review-pr
    uses: xema/webhook
    with:
      url: ${{ trigger.payload.pull_request.comments_url }}
      method: POST
      body:
        body: ${{ needs.review-pr.outputs.review }}
```

### Example: Multi-Event Workflow

```yaml
on:
  webhook:
    - event: scm.push
      filters:
        branch: main
    - event: scm.pull_request
      filters:
        state: [opened, synchronize]

jobs:
  handle-event:
    uses: xema/agent
    with:
      event_type: ${{ trigger.event }}
      payload: ${{ trigger.payload }}
      task: Handle ${{ trigger.event }} event
```

---

## `workflow_call` — Sub-Workflows

Mark a workflow as **reusable** so other workflows can call it as a job step. This enables composition and code reuse across workflows.

### Declaring a Reusable Workflow

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: requirements-sub-workflow
  version: 1.0.0

on:
  workflow_call:
    inputs:
      scope:
        type: string
        enum: [simple, standard, enterprise]
        required: true
      project_name:
        type: string
        required: true
    outputs:
      spec_id:
        value: ${{ needs.create-spec.outputs.spec_id }}
      summary:
        value: ${{ needs.analyze.outputs.summary }}

jobs:
  analyze:
    uses: xema/agent
    with:
      scope: ${{ inputs.scope }}
      task: Analyze requirements
    outputs:
      summary: ${{ result.summary }}

  create-spec:
    needs: analyze
    uses: xema/emit-artifact
    with:
      content: ${{ needs.analyze.outputs.summary }}
    outputs:
      spec_id: ${{ result.artifact_id }}
```

### Calling a Sub-Workflow

From a parent workflow, call a reusable workflow as a job:

```yaml
jobs:
  call-requirements:
    uses: my-org/requirements-sub-workflow@1.0.0
    with:
      scope: enterprise
      project_name: ${{ inputs.project_name }}
    outputs:
      spec_id: ${{ result.spec_id }}
      summary: ${{ result.summary }}

  use-results:
    needs: call-requirements
    with:
      spec_id: ${{ needs.call-requirements.outputs.spec_id }}
```

### Sub-Workflow Outputs

Outputs from `workflow_call` are **expressions** referencing the sub-workflow's job outputs:

```yaml
on:
  workflow_call:
    outputs:
      final_result:
        value: ${{ needs.last-job.outputs.result }}   # Expression referencing an upstream job
      item_count:
        value: ${{ needs.enumerate.outputs.count }}
```

### Trigger Context

```yaml
${{ trigger.kind }}             # "workflow_call"
${{ trigger.parentRunId }}      # ID of the calling workflow run
${{ trigger.parentWorkflowRef }}# e.g., "parent-workflow@2.0.0"
${{ inputs.scope }}             # Forwarded inputs from parent
```

---

## Trigger Context Reference

All triggers share a common base context plus trigger-specific fields:

### Common Fields

```yaml
${{ trigger.kind }}            # "workflow_dispatch" | "schedule" | "webhook" | "workflow_call"
${{ trigger.correlationId }}   # Unique URN for this run (urn:xema:<uuid>)
${{ trigger.orgId }}           # Organization ID
${{ trigger.projectId }}       # Project ID
${{ trigger.actorSubject }}    # User ID who triggered (null for schedule/webhook)
${{ trigger.triggeredAt }}     # ISO 8601 UTC timestamp
```

### By Trigger Type

| Field | `dispatch` | `schedule` | `webhook` | `workflow_call` |
|-------|:---:|:---:|:---:|:---:|
| `trigger.kind` | ✓ | ✓ | ✓ | ✓ |
| `trigger.actorSubject` | ✓ | null | null | null |
| `trigger.cronSpec` | ✗ | ✓ | ✗ | ✗ |
| `trigger.scheduleId` | ✗ | ✓ | ✗ | ✗ |
| `trigger.event` | ✗ | ✗ | ✓ | ✗ |
| `trigger.provider` | ✗ | ✗ | ✓ | ✗ |
| `trigger.deliveryId` | ✗ | ✗ | ✓ | ✗ |
| `trigger.payload.*` | ✗ | ✗ | ✓ | ✗ |
| `trigger.parentRunId` | ✗ | ✗ | ✗ | ✓ |
| `trigger.parentWorkflowRef` | ✗ | ✗ | ✗ | ✓ |
| `inputs.*` | ✓ | ✓ | ✗ | ✓ |

---

## Multi-Trigger Workflows

A workflow can be triggered by multiple trigger types. Use `trigger.kind` to handle them differently:

```yaml
on:
  workflow_dispatch:
    inputs:
      report_type:
        type: string
        enum: [daily, weekly, monthly]
        required: true
  schedule:
    - cron: "0 8 * * *"
      inputs:
        report_type: daily
  webhook:
    - event: tracker.issue
      filters:
        type: report_request

jobs:
  route-trigger:
    uses: xema/agent
    with:
      triggered_by: ${{ trigger.kind }}
      report_type: ${{ inputs.report_type }}
      issue_key: ${{ trigger.payload.issue.key }}   # null for non-webhook
      task: Generate report based on trigger type
```

---

**Next**: [Concurrency & Execution Control](/docs/workflows/features.md#concurrency-control)  
**See Also**: [DSL Reference: Triggers](/docs/dsl/reference.md#triggers)
