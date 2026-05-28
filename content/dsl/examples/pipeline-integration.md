# Examples: Pipeline Integration

DSL examples for connecting workflow jobs to interactive sessions, using outputs across jobs, and building full pipelines.

---

## Basic Pipeline: Dispatch → Session → Notify

The simplest end-to-end pipeline: manually dispatch, run a session, notify on completion.

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: simple-pipeline
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      task:
        type: string
        required: true
      repository_id:
        type: string
        required: true

jobs:
  session:
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
      initialPrompt: ${{ inputs.task }}
    outputs:
      pr_url: ${{ result.pr_url }}

  notify:
    needs: session
    uses: xema/webhook
    with:
      url: https://api.acme.com/notifications
      payload:
        event: pipeline_complete
        pr_url: ${{ needs.session.outputs.pr_url }}
```

---

## Pipeline: Webhook → Automated Jobs → Session → Review

A full pipeline triggered by a GitHub PR, with automated jobs and an interactive session for deeper analysis:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: pr-review-pipeline
  version: 1.0.0

on:
  webhook:
    - event: scm.pull_request
      filters:
        state: opened
        targetBranch: main

jobs:
  # Automated: Static analysis
  static-analysis:
    uses: xema/agent
    with:
      task: Run static analysis on the PR diff
      pr_url: ${{ trigger.payload.pull_request.url }}
    outputs:
      issues: ${{ result.issues }}
      security_findings: ${{ result.security_findings }}
      has_critical_issues: ${{ result.has_critical_issues }}

  # Automated: Test validation
  test-check:
    uses: xema/agent
    with:
      task: Verify tests cover the changed code
      pr_url: ${{ trigger.payload.pull_request.url }}
    outputs:
      coverage: ${{ result.coverage }}
      missing_tests: ${{ result.missing_tests }}

  # Gate: If critical issues, skip session and notify
  block-on-critical:
    needs: [static-analysis, test-check]
    if: ${{ needs.static-analysis.outputs.has_critical_issues == true }}
    uses: xema/webhook
    with:
      url: https://api.acme.com/pr/block
      payload:
        pr_url: ${{ trigger.payload.pull_request.url }}
        reason: Critical security issues found
        issues: ${{ needs.static-analysis.outputs.security_findings }}

  # Interactive: Human + agent review session (only if no critical issues)
  review-session:
    needs: [static-analysis, test-check]
    if: ${{ needs.static-analysis.outputs.has_critical_issues == false }}
    uses: xema/agent-session
    with:
      profileKey: review
      repositoryId: ${{ trigger.payload.repository.id }}
      context: |
        ## Static Analysis Results
        Issues: ${{ needs.static-analysis.outputs.issues }}
        Security: ${{ needs.static-analysis.outputs.security_findings }}

        ## Test Coverage
        Coverage: ${{ needs.test-check.outputs.coverage }}
        Missing Tests: ${{ needs.test-check.outputs.missing_tests }}
      initialPrompt: >
        Perform a thorough code review of this PR based on the analysis above.
        Check for logic errors, performance issues, and adherence to standards.
    outputs:
      review_complete: ${{ result.complete }}
      review_summary: ${{ result.summary }}
      approved: ${{ result.approved }}

  # Final notification
  notify-result:
    needs: review-session
    if: ${{ success() }}
    uses: xema/webhook
    with:
      url: https://api.acme.com/pr/review-complete
      payload:
        pr_url: ${{ trigger.payload.pull_request.url }}
        approved: ${{ needs.review-session.outputs.approved }}
        summary: ${{ needs.review-session.outputs.review_summary }}
```

---

## Pipeline: Using Outputs Across Multiple Dependent Jobs

Demonstrates how to pass data through a multi-stage pipeline:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: data-flow-pipeline
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      project_name:
        type: string
        required: true

jobs:
  step-1-gather:
    uses: xema/agent
    with:
      task: Gather project information
      project_name: ${{ inputs.project_name }}
    outputs:
      metadata: ${{ result.metadata }}
      context: ${{ result.context }}

  step-2-analyze:
    needs: step-1-gather
    uses: xema/agent
    with:
      task: Analyze gathered data
      metadata: ${{ needs.step-1-gather.outputs.metadata }}
      context: ${{ needs.step-1-gather.outputs.context }}
    outputs:
      analysis: ${{ result.analysis }}
      recommendations: ${{ result.recommendations }}
      priority: ${{ result.priority }}

  step-3-implement:
    needs: step-2-analyze
    uses: xema/agent-session
    with:
      profileKey: session
      context: |
        ## Analysis Results
        ${{ needs.step-2-analyze.outputs.analysis }}

        ## Recommendations
        ${{ needs.step-2-analyze.outputs.recommendations }}
      initialPrompt: Implement the top-priority recommendation
    outputs:
      session_id: ${{ result.session_id }}
      artifact_id: ${{ result.artifact_id }}

  step-4-finalize:
    needs: step-3-implement
    uses: xema/agent
    with:
      task: Finalize and package results
      session_id: ${{ needs.step-3-implement.outputs.session_id }}
      artifact_id: ${{ needs.step-3-implement.outputs.artifact_id }}
      analysis: ${{ needs.step-2-analyze.outputs.analysis }}
    outputs:
      final_artifact: ${{ result.artifact_id }}
```

---

## Pipeline: Parallel Sessions

Run multiple sessions in parallel for different aspects of the work:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: parallel-sessions-pipeline
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      repository_id:
        type: string
        required: true
      feature:
        type: string
        required: true

jobs:
  # Prepare context (shared)
  analyze:
    uses: xema/agent
    with:
      task: Analyze codebase and provide context
      feature: ${{ inputs.feature }}
    outputs:
      context: ${{ result.context }}

  # Parallel sessions: backend and frontend simultaneously
  backend-session:
    needs: analyze
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
      context: ${{ needs.analyze.outputs.context }}
      initialPrompt: Implement the backend API for ${{ inputs.feature }}
    outputs:
      pr_url: ${{ result.pr_url }}

  frontend-session:
    needs: analyze
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
      context: ${{ needs.analyze.outputs.context }}
      initialPrompt: Implement the frontend UI for ${{ inputs.feature }}
    outputs:
      pr_url: ${{ result.pr_url }}

  # Wait for both, then validate
  integration-check:
    needs: [backend-session, frontend-session]
    uses: xema/agent
    with:
      task: Verify backend and frontend changes are compatible
      backend_pr: ${{ needs.backend-session.outputs.pr_url }}
      frontend_pr: ${{ needs.frontend-session.outputs.pr_url }}
    outputs:
      compatible: ${{ result.compatible }}
      issues: ${{ result.issues }}
```

---

## Pipeline: Conditional Paths Based on Session Output

Branch the pipeline based on what the session produced:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: conditional-pipeline
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      repository_id:
        type: string
        required: true

jobs:
  engineering-session:
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
    outputs:
      pr_url: ${{ result.pr_url }}
      has_breaking_changes: ${{ result.has_breaking_changes }}
      has_migrations: ${{ result.has_migrations }}
      risk_level: ${{ result.risk_level }}

  # High-risk path: requires tech lead approval
  tech-lead-approval:
    needs: engineering-session
    if: ${{ needs.engineering-session.outputs.risk_level == 'high' }}
    uses: xema/decision-gate
    with:
      approverGroups: [tech-leads]
      context: >
        High-risk changes detected.
        PR: ${{ needs.engineering-session.outputs.pr_url }}
        Breaking changes: ${{ needs.engineering-session.outputs.has_breaking_changes }}
      timeout: "48 hours"

  # Migration path: schedule maintenance window
  schedule-migration:
    needs: engineering-session
    if: ${{ needs.engineering-session.outputs.has_migrations == true }}
    uses: xema/webhook
    with:
      url: https://api.acme.com/maintenance/schedule
      payload:
        pr_url: ${{ needs.engineering-session.outputs.pr_url }}
        migration_required: true

  # Fast path: auto-merge low-risk changes
  auto-merge:
    needs: engineering-session
    if: >-
      ${{ 
        needs.engineering-session.outputs.risk_level == 'low' && 
        needs.engineering-session.outputs.has_breaking_changes == false &&
        needs.engineering-session.outputs.has_migrations == false
      }}
    uses: xema/agent
    with:
      task: Merge the approved pull request
      pr_url: ${{ needs.engineering-session.outputs.pr_url }}
```

---

## Reusable Sub-Workflow for Sessions

Define a reusable session pattern callable from multiple parent workflows:

```yaml
# reusable-engineering-session.yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: reusable-engineering-session
  version: 1.0.0

on:
  workflow_call:
    inputs:
      task:
        type: string
        required: true
      repository_id:
        type: string
        required: true
      deliverable_spec:
        type: string
        required: false
    outputs:
      session_id:
        value: ${{ needs.session.outputs.session_id }}
      pr_url:
        value: ${{ needs.session.outputs.pr_url }}
      artifact_id:
        value: ${{ needs.session.outputs.artifact_id }}

jobs:
  session:
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
      deliverableSpecRef: ${{ inputs.deliverable_spec }}
      initialPrompt: ${{ inputs.task }}
    outputs:
      session_id: ${{ result.session_id }}
      pr_url: ${{ result.pr_url }}
      artifact_id: ${{ result.artifact_id }}
```

**Calling the reusable workflow:**

```yaml
jobs:
  implement-feature:
    uses: my-org/reusable-engineering-session@1.0.0
    with:
      task: Implement OAuth2 authentication
      repository_id: ${{ inputs.repository_id }}

  document-feature:
    uses: my-org/reusable-engineering-session@1.0.0
    with:
      task: Write technical documentation for OAuth2 auth
      repository_id: ${{ inputs.repository_id }}
      deliverable_spec: technical-documentation@1.0.0
```

---

**See Also**: [Interactive Sessions Examples](./agent-sessions.md) | [Pipeline Integration Guide](../../interactive-sessions/02-pipeline-integration.md)
