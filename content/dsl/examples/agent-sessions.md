# Examples: Interactive Sessions

DSL examples for workflows that use interactive sessions — spawning sessions, integrating human collaboration, and connecting session outputs back to pipeline jobs.

---

## Minimal Session Workflow

Dispatch a workflow that spawns a single interactive session:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: single-session
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      task_description:
        type: string
        required: true
      repository_id:
        type: string
        required: true

jobs:
  engineering-session:
    title: Engineering Session
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
      initialPrompt: ${{ inputs.task_description }}
    outputs:
      session_id: ${{ result.session_id }}
      pr_url: ${{ result.pr_url }}
```

---

## Session with Pre-Analysis

Run automated analysis first, then hand off to human + agent session:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: analyze-then-session
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      feature_request:
        type: string
        required: true
      repository_id:
        type: string
        required: true

jobs:
  analyze:
    title: Analyze Feature Request
    uses: xema/agent
    with:
      task: Analyze feature request and produce implementation context
      request: ${{ inputs.feature_request }}
    outputs:
      context: ${{ result.context }}
      affected_files: ${{ result.affected_files }}
      estimated_complexity: ${{ result.complexity }}

  implement:
    title: Implementation Session
    needs: analyze
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
      context: |
        ## Feature Analysis
        ${{ needs.analyze.outputs.context }}

        ## Affected Files
        ${{ needs.analyze.outputs.affected_files }}
      initialPrompt: >
        Based on the analysis above, implement the feature:
        "${{ inputs.feature_request }}"
    outputs:
      session_id: ${{ result.session_id }}
      pr_url: ${{ result.pr_url }}

  notify:
    title: Notify Team
    needs: implement
    if: ${{ success() && needs.implement.outputs.pr_url != null }}
    uses: xema/webhook
    with:
      url: https://api.acme.com/notifications/pr-ready
      payload:
        pr_url: ${{ needs.implement.outputs.pr_url }}
        session_id: ${{ needs.implement.outputs.session_id }}
        feature: ${{ inputs.feature_request }}
```

---

## Session with Post-Validation

Validate session output with an automated job before notifying reviewers:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: session-with-validation
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
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
    outputs:
      session_id: ${{ result.session_id }}
      pr_url: ${{ result.pr_url }}

  validate-code:
    needs: session
    uses: xema/agent
    with:
      task: Review pull request for code quality, security, and test coverage
      pr_url: ${{ needs.session.outputs.pr_url }}
    outputs:
      quality_score: ${{ result.quality_score }}
      security_issues: ${{ result.security_issues }}
      test_coverage: ${{ result.test_coverage }}
      ready_for_review: ${{ result.ready_for_review }}

  request-human-review:
    needs: validate-code
    if: ${{ needs.validate-code.outputs.ready_for_review == true }}
    uses: xema/decision-gate
    with:
      approverGroups: [tech-leads]
      context: |
        PR ready for review.

        **Quality Score**: ${{ needs.validate-code.outputs.quality_score }}
        **Security Issues**: ${{ needs.validate-code.outputs.security_issues }}
        **Test Coverage**: ${{ needs.validate-code.outputs.test_coverage }}

        **PR**: ${{ needs.session.outputs.pr_url }}
      timeout: "2 days"

  flag-issues:
    needs: validate-code
    if: ${{ needs.validate-code.outputs.ready_for_review == false }}
    uses: xema/webhook
    with:
      url: https://api.acme.com/notifications/session-needs-work
      payload:
        session_id: ${{ needs.session.outputs.session_id }}
        pr_url: ${{ needs.session.outputs.pr_url }}
        issues: ${{ needs.validate-code.outputs.security_issues }}
```

---

## Multi-Session Pipeline

Sequential sessions for different workflow phases:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: multi-session-pipeline
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      feature_request:
        type: string
        required: true
      repository_id:
        type: string
        required: true

jobs:
  # Phase 1: Architecture session
  architecture:
    title: Architecture Design Session
    uses: xema/agent-session
    with:
      profileKey: session
      deliverableSpecRef: architecture-decision-record@1.0.0
      initialPrompt: Design the architecture for ${{ inputs.feature_request }}
    outputs:
      architecture_doc: ${{ result.artifact_id }}
      decisions: ${{ result.decisions }}

  # Phase 2: Requirements session (uses architecture output)
  requirements:
    title: Requirements Documentation Session
    needs: architecture
    uses: xema/agent-session
    with:
      profileKey: session
      deliverableSpecRef: requirements-standard@1.0.0
      context: |
        ## Architecture Decisions
        ${{ needs.architecture.outputs.decisions }}
      initialPrompt: Write detailed requirements based on the architecture above
    outputs:
      requirements_doc: ${{ result.artifact_id }}

  # Phase 3: Implementation session (uses requirements)
  implementation:
    title: Implementation Session
    needs: requirements
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
      context: ${{ needs.requirements.outputs.requirements_doc }}
      initialPrompt: Implement the feature according to the requirements
    outputs:
      pr_url: ${{ result.pr_url }}
      session_id: ${{ result.session_id }}

  # Phase 4: Automated review
  review:
    title: Automated Review
    needs: implementation
    uses: xema/agent
    with:
      task: Review implementation against requirements
      pr_url: ${{ needs.implementation.outputs.pr_url }}
      requirements: ${{ needs.requirements.outputs.requirements_doc }}
    outputs:
      approved: ${{ result.approved }}
      review_summary: ${{ result.summary }}
```

---

## Session Triggered by Webhook

Spawn a session when a specific GitHub PR event occurs:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: pr-session-on-review-request
  version: 1.0.0

on:
  webhook:
    - event: scm.pull_request
      filters:
        state: review_requested

jobs:
  review-session:
    title: Code Review Session
    uses: xema/agent-session
    with:
      profileKey: review
      repositoryId: ${{ trigger.payload.repository.id }}
      context: |
        ## Pull Request
        **Title**: ${{ trigger.payload.pull_request.title }}
        **Branch**: ${{ trigger.payload.pull_request.branch }}
        **Author**: ${{ trigger.payload.pull_request.author }}
      initialPrompt: >
        Please review this pull request for code quality, correctness,
        security, and adherence to our standards. Post your review
        as a PR comment when complete.
    outputs:
      session_id: ${{ result.session_id }}
```

---

## Session with Approval Gate and Retry

Use approval gates to allow iterating before finalizing:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: session-with-iteration
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
  initial-session:
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
      initialPrompt: ${{ inputs.task }}
    outputs:
      session_id: ${{ result.session_id }}
      pr_url: ${{ result.pr_url }}

  # Gate: engineer reviews and decides
  review-gate:
    needs: initial-session
    uses: xema/decision-gate
    with:
      approverGroups: [engineers]
      context: |
        Session completed. Please review the PR.

        **PR**: ${{ needs.initial-session.outputs.pr_url }}
        **Session**: ${{ needs.initial-session.outputs.session_id }}
      choices:
        - label: Looks good — merge it
          value: approve
        - label: Needs more work — continue session
          value: iterate
      timeout: "24 hours"
    outputs:
      decision: ${{ result.choice }}

  # Approved path
  auto-merge:
    needs: review-gate
    if: ${{ needs.review-gate.outputs.decision == 'approve' }}
    uses: xema/agent
    with:
      task: Merge the pull request
      pr_url: ${{ needs.initial-session.outputs.pr_url }}

  # Iterate path: resume or fork session
  iteration-session:
    needs: review-gate
    if: ${{ needs.review-gate.outputs.decision == 'iterate' }}
    uses: xema/agent-session
    with:
      profileKey: session
      parentSessionId: ${{ needs.initial-session.outputs.session_id }}  # Fork from first session
      initialPrompt: Continue working on the feedback from the review
    outputs:
      session_id: ${{ result.session_id }}
      pr_url: ${{ result.pr_url }}
```

---

## Scheduled Daily Engineering Session

Run a scheduled session to handle daily maintenance tasks:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: daily-maintenance-session
  version: 1.0.0

on:
  schedule:
    - cron: "0 9 * * MON-FRI"
      timezone: "UTC"
      inputs:
        task_type: daily_maintenance
  workflow_dispatch:
    inputs:
      task_type:
        type: string
        enum: [daily_maintenance, security_patches, dependency_updates]
        required: true
      repository_id:
        type: string
        required: true

concurrency:
  group: maintenance-${{ inputs.repository_id }}
  mode: skip

jobs:
  maintenance-session:
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
      initialPrompt: >
        Run the ${{ inputs.task_type }} workflow:
        - Check for outdated dependencies and propose updates
        - Review and fix any linting errors
        - Ensure all tests pass
        - Create a PR with a summary of changes
    outputs:
      pr_url: ${{ result.pr_url }}

  notify-on-completion:
    needs: maintenance-session
    uses: xema/webhook
    with:
      url: https://api.acme.com/maintenance/report
      payload:
        task_type: ${{ inputs.task_type }}
        pr_url: ${{ needs.maintenance-session.outputs.pr_url }}
        triggered_by: ${{ trigger.kind }}
```

---

**See Also**: [Interactive Sessions Overview](../../interactive-sessions/index.md) | [Pipeline Integration](../../interactive-sessions/02-pipeline-integration.md)
