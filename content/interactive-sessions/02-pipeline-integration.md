# Interactive Sessions: Pipeline Integration

> API Docs: https://agent-session-api.xema.dev/api/docs

How to use interactive sessions as part of automated workflow pipelines.

## Overview

Interactive sessions can be embedded into workflow pipelines to provide **human-in-the-loop** collaboration at key points. The typical pattern:

1. Automated workflow jobs execute analysis, planning, or preparation
2. Pipeline reaches a human collaboration point → spawns an interactive session
3. Engineer and agent collaborate (review, write code, make decisions)
4. Session completes → pipeline resumes with results
5. Subsequent automated jobs use session outputs (artifacts, PR URL, etc.)

---

## Basic Pattern

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: feature-implementation
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      feature_description:
        type: string
        required: true
      repository_id:
        type: string
        required: true

jobs:
  # 1. Analyze the feature request
  analyze-requirements:
    title: Analyze Feature Requirements
    uses: xema/agent
    with:
      task: Analyze feature requirements and create implementation plan
      description: ${{ inputs.feature_description }}
    outputs:
      plan: ${{ result.plan }}
      complexity: ${{ result.complexity }}
      estimated_files: ${{ result.estimated_files }}

  # 2. Human collaboration: implement the feature
  implement-feature:
    title: Implement Feature (Human + Agent Session)
    needs: analyze-requirements
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
      context: ${{ needs.analyze-requirements.outputs.plan }}
      initialPrompt: >
        Please implement the feature based on the analysis plan.
        Create clean, tested code following our standards.
    outputs:
      session_id: ${{ result.session_id }}
      pr_url: ${{ result.pr_url }}
      branch_name: ${{ result.branch_name }}

  # 3. Automated code review after session
  review-pr:
    title: Review Pull Request
    needs: implement-feature
    if: ${{ needs.implement-feature.outputs.pr_url != null }}
    uses: xema/agent
    with:
      task: Review the pull request for quality and standards
      pr_url: ${{ needs.implement-feature.outputs.pr_url }}
    outputs:
      approved: ${{ result.approved }}
      comments: ${{ result.comments }}

  # 4. Notify team
  notify-review-ready:
    title: Notify Team
    needs: review-pr
    if: ${{ success() }}
    uses: xema/webhook
    with:
      url: https://api.acme.com/notifications
      payload:
        event: pr_ready_for_review
        pr_url: ${{ needs.implement-feature.outputs.pr_url }}
        review_summary: ${{ needs.review-pr.outputs.comments }}
```

---

## Pattern: Preparation → Session → Validation

A common pattern where automated steps prepare context, a session does the work, and automated steps validate outputs:

```yaml
jobs:
  # Prepare: Gather all context
  gather-context:
    uses: xema/agent
    with:
      task: Gather relevant context for the task
      repository_id: ${{ inputs.repository_id }}
    outputs:
      context_summary: ${{ result.summary }}
      relevant_files: ${{ result.files }}

  # Session: Human + agent implementation
  engineering-session:
    needs: gather-context
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      context: ${{ needs.gather-context.outputs.context_summary }}
    outputs:
      session_id: ${{ result.session_id }}
      pr_url: ${{ result.pr_url }}

  # Validate: Check quality gates
  validate-output:
    needs: engineering-session
    uses: xema/agent
    with:
      task: Validate the implementation meets requirements
      pr_url: ${{ needs.engineering-session.outputs.pr_url }}
    outputs:
      passed: ${{ result.passed }}
      issues: ${{ result.issues }}

  # Block on approval if validation found issues
  request-fix:
    needs: validate-output
    if: ${{ needs.validate-output.outputs.passed == false }}
    uses: xema/decision-gate
    with:
      approverGroups: [engineers]
      context: >
        Validation found issues.
        Issues: ${{ needs.validate-output.outputs.issues }}
      timeout: "2 days"
```

---

## Pattern: Multi-Phase Pipeline with Sessions

Full pipeline with multiple sessions across phases:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: full-development-pipeline
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      feature_request:
        type: string
        required: true

jobs:
  # Phase 1: Requirements analysis (automated)
  analyze:
    uses: xema/agent
    with:
      task: Analyze and document requirements
      request: ${{ inputs.feature_request }}
    outputs:
      spec_id: ${{ result.spec_id }}
      requirements: ${{ result.requirements }}

  # Phase 2: Architecture session (human + agent)
  architecture-session:
    needs: analyze
    uses: xema/agent-session
    with:
      profileKey: session
      context: ${{ needs.analyze.outputs.requirements }}
      initialPrompt: Design the architecture for this feature
    outputs:
      architecture_doc: ${{ result.artifact_id }}
      decisions: ${{ result.decisions }}

  # Phase 3: Implementation session (human + agent)
  implementation-session:
    needs: architecture-session
    uses: xema/agent-session
    with:
      profileKey: session
      repositoryId: ${{ inputs.repository_id }}
      branchStrategy: auto_create
      context: ${{ needs.architecture-session.outputs.decisions }}
    outputs:
      pr_url: ${{ result.pr_url }}
      session_id: ${{ result.session_id }}

  # Phase 4: Governance review (automated)
  governance-review:
    needs: implementation-session
    uses: xema/agent
    with:
      task: Review implementation for compliance and standards
      pr_url: ${{ needs.implementation-session.outputs.pr_url }}
    outputs:
      compliant: ${{ result.compliant }}
      issues: ${{ result.issues }}

  # Phase 5: Approval gate
  final-approval:
    needs: governance-review
    uses: xema/decision-gate
    with:
      approverGroups: [tech-leads]
      context: >
        Implementation complete. PR: ${{ needs.implementation-session.outputs.pr_url }}
        Governance: ${{ needs.governance-review.outputs.compliant }}
```

---

## Session Context & Initialization

When launching a session from a pipeline, you can provide:

### `context`

Markdown context document given to the agent at session start. Use this to transfer information from previous workflow steps:

```yaml
with:
  context: |
    ## Requirements Analysis Summary
    ${{ needs.analyze.outputs.requirements }}
    
    ## Relevant Files
    ${{ needs.gather-context.outputs.relevant_files }}
```

### `initialPrompt`

The first message sent to the agent automatically:

```yaml
with:
  initialPrompt: >
    Based on the requirements above, please implement the authentication
    module with JWT tokens, refresh token rotation, and session management.
```

### `deliverableSpecRef`

Mount a document template for the agent to produce:

```yaml
with:
  deliverableSpecRef: requirements-standard@1.0.0
```

---

## Accessing Session Outputs in Pipeline

After a session completes, outputs are available to subsequent jobs:

```yaml
jobs:
  engineering-session:
    uses: xema/agent-session
    outputs:
      session_id: ${{ result.session_id }}
      pr_url: ${{ result.pr_url }}
      branch_name: ${{ result.branch_name }}
      artifact_id: ${{ result.artifact_id }}   # If session produced a deliverable

  use-session-output:
    needs: engineering-session
    with:
      pr_url: ${{ needs.engineering-session.outputs.pr_url }}
      session_id: ${{ needs.engineering-session.outputs.session_id }}
```

---

## Monitoring Pipeline Sessions

Track sessions linked to a pipeline run:

```bash
# List sessions for a pipeline run
curl "https://agent-session-api.xema.dev/sessions?pipelineRunId=run-123" \
  -H "Authorization: Bearer $TOKEN"

# Get specific session
curl "https://agent-session-api.xema.dev/sessions/{sessionId}" \
  -H "Authorization: Bearer $TOKEN"

# Watch events
curl "https://agent-session-api.xema.dev/sessions/{sessionId}/events" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error Handling in Pipelines

Handle session failures gracefully:

```yaml
jobs:
  engineering-session:
    uses: xema/agent-session
    with:
      profileKey: session
    outputs:
      pr_url: ${{ result.pr_url }}

  handle-session-failure:
    needs: engineering-session
    if: ${{ failure() }}
    uses: xema/webhook
    with:
      url: https://api.acme.com/notify
      payload:
        event: session_failed
        pipeline_run_id: ${{ runId }}
        reason: Engineering session did not complete

  continue-on-success:
    needs: engineering-session
    if: ${{ success() }}
    uses: xema/agent
    with:
      task: Review the completed session work
      pr_url: ${{ needs.engineering-session.outputs.pr_url }}
```

---

**Previous**: [API Reference](./03-api-reference.md)  
**See Also**: [DSL Examples: Interactive Sessions](../dsl/examples/agent-sessions.md)
