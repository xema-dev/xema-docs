# DSL Examples

> API Docs: https://workflow-engine-api.xema.dev/api/docs

Common workflow patterns and examples.

## Table of Contents

1. [Simple Workflows](#simple-workflows)
2. [Multi-Stage Pipelines](#multi-stage-pipelines)
3. [Approval Workflows](#approval-workflows)
4. [Integration Patterns](#integration-patterns)
5. [Dynamic Workflows](#dynamic-workflows)
6. [Error Handling](#error-handling)

---

## Simple Workflows

### Example 1: Hello World

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: hello-world
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      name:
        type: string
        required: true

jobs:
  greet:
    uses: xema/agent
    with:
      task: Say hello to ${{ inputs.name }}
```

**Trigger**: Manual dispatch with name input

### Example 2: Scheduled Task

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: weekly-report
  version: 1.0.0

on:
  schedule:
    - cron: "0 9 * * MON"           # Monday 9 AM
      inputs:
        report_type: weekly

jobs:
  generate-report:
    uses: xema/agent
    with:
      task: Generate ${{ inputs.report_type }} report
```

**Trigger**: Every Monday at 9 AM

---

## Multi-Stage Pipelines

### Example 3: Requirements Analysis Pipeline

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: requirements-analysis
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      project_name:
        type: string
        required: true
      scope:
        type: string
        enum: [simple, standard, enterprise]
        required: true

vars:
  organization: "Acme Corp"
  max_analysis_days: 5

jobs:
  # Phase 1: Analyze requirements
  analyze:
    title: Analyze Project Requirements
    uses: xema/agent
    with:
      task: Analyze project requirements
      project_name: ${{ inputs.project_name }}
      scope: ${{ inputs.scope }}
      organization: ${{ vars.organization }}
    outputs:
      summary: ${{ result.summary }}
      requirements: ${{ result.requirements }}
      risks: ${{ result.risks }}
      effort_estimate: ${{ result.effort_days }}

  # Phase 2: Review by requirements team
  technical-review:
    title: Technical Review
    needs: analyze
    uses: xema/decision-gate
    with:
      approverGroups: [tech-leads]
      timeout: "3 days"
      context: ${{ needs.analyze.outputs.summary }}

  # Phase 3: Create specification
  create-spec:
    title: Create Specification Document
    needs: [analyze, technical-review]
    if: ${{ success() }}
    uses: xema/agent
    with:
      requirements: ${{ needs.analyze.outputs.requirements }}
      template: requirements-${{ inputs.scope }}
      estimated_effort: ${{ needs.analyze.outputs.effort_estimate }}
    outputs:
      spec_id: ${{ result.artifact_id }}
      spec_version: ${{ result.version }}

  # Phase 4: PM approval
  pm-approval:
    title: Product Manager Approval
    needs: create-spec
    uses: xema/decision-gate
    with:
      approverGroups: [product-managers]
      quorum: 1
      timeout: "2 days"
      timeoutAction: escalate

  # Phase 5: Publish
  publish-spec:
    title: Publish Specification
    needs: [create-spec, pm-approval]
    if: ${{ success() }}
    uses: xema/emit-artifact
    with:
      type: requirements_spec
      content: ${{ needs.create-spec.outputs.spec_content }}
      metadata:
        phase: requirements
        project_name: ${{ inputs.project_name }}
        scope: ${{ inputs.scope }}

  # Phase 6: Notify
  notify-completion:
    title: Notify Stakeholders
    needs: publish-spec
    if: ${{ always() }}
    uses: xema/webhook
    with:
      url: https://notifications.acme.com/webhooks
      payload:
        event: spec_published
        spec_id: ${{ needs.publish-spec.outputs.artifact_id }}
        project: ${{ inputs.project_name }}
        status: ${{ needs.publish-spec.result.status }}
```

**Features**:
- Sequential pipeline (needs)
- Inputs with enum
- Workflow variables
- Agent invocation
- Human approvals
- Conditional execution
- Artifact emission
- Webhook notification

---

## Approval Workflows

### Example 4: Multi-Level Approval

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: multi-level-approval
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      request_type:
        type: string
        enum: [small, standard, large]
        required: true
      amount:
        type: number
        required: true

jobs:
  # Route based on amount
  technical-approval:
    if: ${{ inputs.amount < 50000 }}
    uses: xema/decision-gate
    with:
      approverGroups: [tech-leads]
      quorum: 1
      timeout: "1 day"

  management-approval:
    if: ${{ inputs.amount >= 50000 && inputs.amount < 250000 }}
    needs: technical-approval
    uses: xema/decision-gate
    with:
      approverGroups: [managers]
      quorum: 1
      timeout: "2 days"

  executive-approval:
    if: ${{ inputs.amount >= 250000 }}
    needs: technical-approval
    uses: xema/decision-gate
    with:
      approverGroups: [executives]
      quorum: 2                      # Requires 2 votes
      timeout: "3 days"
      timeoutAction: escalate

  approved:
    needs: [technical-approval, management-approval, executive-approval]
    if: ${{ success() }}
    uses: xema/webhook
    with:
      url: https://api.acme.com/process
      payload:
        approved: true
        amount: ${{ inputs.amount }}
```

**Features**:
- Conditional routing
- Tiered approvals
- Quorum voting
- Timeout handling
- Sequential with conditional needs

---

## Integration Patterns

### Example 5: GitHub PR Workflow

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: github-pr-review
  version: 1.0.0

on:
  webhook:
    - event: scm.pull_request
      filters:
        state: opened

jobs:
  analyze-pr:
    title: Analyze Pull Request
    uses: xema/agent
    with:
      task: Review pull request code
      pr_title: ${{ trigger.payload.pull_request.title }}
      pr_number: ${{ trigger.payload.pull_request.number }}
      diff: ${{ trigger.payload.pull_request.diff }}
      branch: ${{ trigger.payload.pull_request.branch }}
    outputs:
      review: ${{ result.review }}
      issues: ${{ result.issues }}
      approved: ${{ result.approved }}

  post-comment:
    needs: analyze-pr
    uses: xema/webhook
    with:
      url: ${{ trigger.payload.pull_request.comments_url }}
      method: POST
      body:
        body: ${{ needs.analyze-pr.outputs.review }}

  approve-status:
    needs: analyze-pr
    if: ${{ needs.analyze-pr.outputs.approved == true }}
    uses: xema/http
    with:
      url: ${{ trigger.payload.pull_request.status_url }}
      method: POST
      body:
        state: success
        description: "Code review approved"

  request-changes:
    needs: analyze-pr
    if: ${{ needs.analyze-pr.outputs.approved == false }}
    uses: xema/http
    with:
      url: ${{ trigger.payload.pull_request.status_url }}
      method: POST
      body:
        state: failure
        description: "Changes requested in review"
```

**Features**:
- Webhook trigger (GitHub PR)
- Conditional workflow (approved vs not)
- HTTP calls to external APIs
- Webhook notifications

### Example 6: Jira Issue to Workflow

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: jira-issue-workflow
  version: 1.0.0

on:
  webhook:
    - event: tracker.issue
      filters:
        type: feature
        priority: high

jobs:
  analyze-feature:
    title: Analyze Feature Request
    uses: xema/agent
    with:
      task: Create feature specification
      issue_key: ${{ trigger.payload.issue.key }}
      title: ${{ trigger.payload.issue.title }}
      description: ${{ trigger.payload.issue.description }}
      priority: ${{ trigger.payload.issue.priority }}
    outputs:
      spec_id: ${{ result.spec_id }}

  update-issue:
    needs: analyze-feature
    uses: xema/http
    with:
      url: https://jira.acme.com/rest/api/3/issues/${{ trigger.payload.issue.key }}
      method: PUT
      headers:
        Authorization: Bearer ${{ secrets.JIRA_TOKEN }}
      body:
        fields:
          labels:
            - spec-generated
          customfield_10001: ${{ needs.analyze-feature.outputs.spec_id }}
```

**Features**:
- Jira webhook trigger
- Feature filter
- Spec generation
- Back-reference to Jira

---

## Dynamic Workflows

### Example 7: Matrix Test

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: matrix-test
  version: 1.0.0

on:
  workflow_dispatch:

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-22.04, windows-2022, macos-13]
        python-version: [3.10, 3.11, 3.12]
        include:
          - os: ubuntu-22.04
            python-version: "3.13"  # Extra combo
      maxParallel: 4                # Max 4 jobs at once
    uses: xema/agent
    with:
      os: ${{ matrix.os }}
      python_version: ${{ matrix.python-version }}
      task: "Run tests on ${{ matrix.os }} with Python ${{ matrix.python-version }}"
    outputs:
      test_result: ${{ result.result }}

  report:
    needs: test
    uses: xema/agent
    with:
      all_results: ${{ needs.test.outputs[*] }}
      total_passed: ${{ length(filter(needs.test.outputs, 'passed')) }}
      task: Generate test report
```

**Features**:
- Static matrix (compile-time)
- `maxParallel` limiting
- `include` for extra combinations
- Accessing all matrix outputs

### Example 8: Dynamic Discovery

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: dynamic-matrix
  version: 1.0.0

on:
  workflow_dispatch:

jobs:
  discover-services:
    title: Discover Services
    uses: xema/agent
    with:
      task: List all microservices in the project
    outputs:
      services: ${{ result.service_list }}

  deploy-each:
    title: Deploy Each Service
    needs: discover-services
    strategy:
      dynamic:
        from: ${{ needs.discover-services.outputs.services }}
        as: service
        maxEntries: 100
    uses: xema/agent
    with:
      service_name: ${{ dynamic.service.name }}
      service_version: ${{ dynamic.service.version }}
      task: Deploy service ${{ dynamic.service.name }}
```

**Features**:
- Discovery job
- Dynamic matrix (runtime)
- Computed from previous output
- Safe expansion limit

---

## Error Handling

### Example 9: Retry and Fallback

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: error-handling
  version: 1.0.0

defaults:
  retry:
    maxAttempts: 3
    backoffCoefficient: 2.0

on:
  workflow_dispatch:

jobs:
  primary-task:
    uses: xema/agent
    with:
      task: Primary processing task
      timeout: "30m"
    outputs:
      result: ${{ result.output }}

  fallback-task:
    if: ${{ failure() }}
    uses: xema/agent
    with:
      task: Fallback processing
      previous_error: ${{ result.error }}

  cleanup:
    if: ${{ always() }}
    uses: xema/agent
    with:
      task: Cleanup resources
      status: ${{ result.status }}

  notify-failure:
    needs: [primary-task, fallback-task]
    if: ${{ failure() }}
    uses: xema/webhook
    with:
      url: https://alerts.acme.com/webhook
      payload:
        status: failed
        reason: Task failed after retries
```

**Features**:
- Default retry policy
- Failure condition
- Fallback job
- Always cleanup
- Failure notification

---

**Next**: Read [Best Practices](../02-best-practices.md) for conventions and tips.
