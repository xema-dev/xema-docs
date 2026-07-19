# Integration Guide

> API Docs: https://workflow-engine-api.xema.dev/api/docs
> Integration API Docs: https://integration-adapters-api.xema.dev/api/docs

This document explains how external systems integrate with Xema Workflows, including webhook triggers, trigger payloads, external actions, and best practices.

## Table of Contents

1. [Overview](#overview)
2. [Single Ingress Edge Architecture](#single-ingress-edge-architecture)
3. [Webhook Triggers](#webhook-triggers)
4. [Supported Providers](#supported-providers)
5. [Trigger Payloads](#trigger-payloads)
6. [Workflow Dispatch API](#workflow-dispatch-api)
7. [External Actions](#external-actions)
8. [Integration Patterns](#integration-patterns)
9. [Security & Authentication](#security--authentication)
10. [Idempotency & Retry](#idempotency--retry)

---

## Overview

### How Integration Works

External systems trigger and interact with Xema Workflows through:

1. **Webhook triggers** — GitHub, GitLab, Jira, Slack, custom webhooks
2. **API dispatch** — Manual workflow triggers via REST API
3. **Schedule triggers** — Cron-based automation
4. **Workflow calls** — Workflows calling other workflows

### Architecture Principle

**Single Ingress Edge**: All external provider webhooks flow through a **single normalization layer** (`integration-adapters-api`), which standardizes events into canonical envelope format before routing to domain services.

This ensures:
- ✅ Consistent webhook handling across providers
- ✅ Single security boundary
- ✅ Deterministic idempotency keys
- ✅ No direct webhook access to domain services

---

## Single Ingress Edge Architecture

### Flow Diagram

```
External Provider          Integration Adapter        Workflow Engine
(GitHub, GitLab,    →      (Normalize Event)    →    (Trigger Workflow)
 Jira, Slack, ...)
                              ↓
                    Canonical Envelope
                    (provider, event, payload)
                              ↓
                    Idempotency Check
                    (provider:deliveryId)
                              ↓
                    POST /webhooks/provider-data
                    (Domain Service)
                              ↓
                    Workflow Match & Trigger
                    (Filter by projectId, branch, etc.)
```

### Benefits

1. **Normalization** — All providers speak the same language
2. **Idempotency** — Deterministic keys prevent duplicate execution
3. **Security** — Single validation point
4. **Extensibility** — Add new providers without touching domain services
5. **Auditability** — Complete webhook history

---

## Webhook Triggers

### Declaring Webhook Triggers

Workflows declare which events they respond to:

```yaml
on:
  webhook:
    - event: scm.push
      filters:
        projectId: proj_123
        branch: main
    - event: scm.pull_request
      filters:
        projectId: proj_123
        state: opened
    - event: tracker.issue
      filters:
        projectId: proj_123
        type: feature
    - event: tracker.issue
      filters:
        projectId: proj_123
        type: bug
        priority: high
```

### Event Filters

Webhooks are only triggered if **all specified filters match**:

```yaml
filters:
  projectId: proj_123           # Project ID
  branch: main                  # Branch name (SCM only)
  state: opened                 # State (PR/issue)
  type: feature                 # Issue type
  priority: high                # Priority level
```

### Accessing Webhook Data

In workflow jobs, access the incoming webhook:

```yaml
jobs:
  process-push:
    uses: xema/agent
    with:
      provider: ${{ trigger.provider }}        # e.g., "github"
      event: ${{ trigger.event }}              # e.g., "scm.push"
      repo: ${{ trigger.payload.repo.name }}
      branch: ${{ trigger.payload.branch }}
      commit_sha: ${{ trigger.payload.commit.sha }}
      commit_message: ${{ trigger.payload.commit.message }}
      author: ${{ trigger.payload.commit.author }}
```

---

## Supported Providers

### SCM Providers

#### GitHub

**Events**:
- `scm.push` — Code pushed to repository
- `scm.pull_request` — Pull request opened/updated/closed
- `scm.repository` — Repository created/deleted
- `scm.installation` — GitHub App installed/uninstalled

**Payload**:
```json
{
  "provider": "GITHUB",
  "adapterKey": "SCM",
  "event": "scm.push",
  "payload": {
    "repo": {
      "name": "myrepo",
      "owner": "acme",
      "url": "https://github.com/acme/myrepo",
      "isPrivate": false
    },
    "branch": "main",
    "before": "abc123...",
    "after": "def456...",
    "commits": [...],
    "pusher": "alice"
  }
}
```

#### GitLab

**Events**:
- `scm.push` — Push event
- `scm.pull_request` — Merge request events (opened, updated, merged)

**Payload**: Similar structure to GitHub

#### Gitea

**Events**:
- `scm.push` — Push event
- `scm.pull_request` — Pull request events

#### Azure DevOps

**Events**:
- `scm.push` — Code pushed
- `scm.pull_request` — Pull request events

### Issue Tracker Providers

#### Jira

**Events**:
- `tracker.issue` — Issue created/updated/transitioned

**Payload**:
```json
{
  "provider": "ATLASSIAN",
  "adapterKey": "TRACKER",
  "event": "tracker.issue",
  "payload": {
    "issue": {
      "key": "PROJ-123",
      "title": "Add user authentication",
      "description": "...",
      "type": "feature",
      "status": "in-progress",
      "priority": "high",
      "assignee": "bob@acme.com",
      "reporter": "alice@acme.com",
      "labels": ["backend", "urgent"]
    }
  }
}
```

#### Confluence

**Events**:
- `doc.page` — Page created/updated

### Communication Providers

#### Slack

**Events**:
- `message.received` — Direct message received
- `reaction.added` — Reaction added

**Payload**:
```json
{
  "provider": "SLACK",
  "event": "message.received",
  "payload": {
    "channel": "C12345678",
    "user": "U12345678",
    "text": "Hey, start a workflow",
    "timestamp": "1234567890.123456"
  }
}
```

---

## Trigger Payloads

### Canonical Envelope Format

All webhooks are normalized to this format:

```typescript
interface IntegrationWebhookEnvelope<TPayload = unknown> {
  // Provider and adapter info
  provider: ConnectorKind
    // GITHUB | GITLAB | GITEA | AZURE_DEVOPS | ATLASSIAN | SLACK

  adapterKey: AdapterKey
    // SCM | TRACKER | DOC

  // Event identification
  entityKind: WebhookEntityKind
    // Discriminator: scm.push, scm.pull_request, tracker.issue, etc.

  event: string
    // Canonical event name (e.g., "scm.push")

  // Event-specific data
  payload: TPayload
    // Typed based on event kind

  // Idempotency
  deliveryId: string
    // Unique per webhook delivery (for deduplication)
}
```

### Idempotency Key

The workflow engine computes:

```
Idempotency-Key = {provider}:{deliveryId}
```

This ensures:
- Each webhook is processed exactly once
- Duplicate deliveries are detected and skipped
- Safe retry without side effects

### Payload Examples

#### GitHub Push Event

```yaml
on:
  webhook:
    - event: scm.push

jobs:
  on-push:
    uses: xema/agent
    with:
      repo_url: ${{ trigger.payload.repo.url }}
      branch: ${{ trigger.payload.branch }}
      commits: ${{ trigger.payload.commits }}
      pusher: ${{ trigger.payload.pusher }}
```

#### Jira Issue Event

```yaml
on:
  webhook:
    - event: tracker.issue
      filters:
        type: feature

jobs:
  on-issue:
    uses: xema/agent
    with:
      issue_key: ${{ trigger.payload.issue.key }}
      title: ${{ trigger.payload.issue.title }}
      priority: ${{ trigger.payload.issue.priority }}
      assignee: ${{ trigger.payload.issue.assignee }}
```

---

## Workflow Dispatch API

### Manual Trigger via REST API

Trigger a workflow manually:

```bash
curl -X POST https://workflow-engine-api.xema.dev/workflows/{slug}/dispatch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "wf_123",
    "inputs": {
      "project_name": "Acme Portal",
      "scope": "full",
      "budget": 500000
    }
  }'
```

### Response

```json
{
  "runId": "run_abc123",
  "status": "pending",
  "createdAt": "2026-04-27T14:30:00Z"
}
```

### Polling for Results

```bash
curl -X GET https://workflow-engine-api.xema.dev/runs/run_abc123 \
  -H "Authorization: Bearer $TOKEN"
```

Response:

```json
{
  "runId": "run_abc123",
  "workflowId": "wf_123",
  "status": "running",
  "jobs": [
    {
      "jobId": "job_1",
      "status": "running"
    }
  ],
  "startedAt": "2026-04-27T14:30:05Z"
}
```

---

## External Actions

### Custom Webhooks

Workflows can send webhooks to external systems:

```yaml
jobs:
  send-notification:
    needs: analysis
    uses: xema/webhook
    with:
      url: https://hooks.acme.com/deployments
      method: POST
      headers:
        Authorization: "Bearer ${{ secrets.WEBHOOK_TOKEN }}"
        Content-Type: application/json
      payload:
        status: ${{ needs.analysis.outputs.status }}
        result: ${{ needs.analysis.outputs.result }}
```

### HTTP Requests

Make arbitrary HTTP calls:

```yaml
jobs:
  call-external-api:
    uses: xema/http
    with:
      url: https://api.external.com/process
      method: POST
      headers:
        Authorization: "Bearer ${{ secrets.API_KEY }}"
      body:
        data: ${{ needs.previous.outputs.data }}
    outputs:
      response: ${{ result.body }}
```

### Integration with External Tools

**Example: Trigger AWS Lambda**

```yaml
jobs:
  trigger-lambda:
    uses: xema/http
    with:
      url: https://lambda.amazonaws.com/invoke
      method: POST
      headers:
        Authorization: "Bearer ${{ secrets.AWS_TOKEN }}"
      body:
        functionName: my-function
        payload:
          input: ${{ inputs.data }}
```

**Example: Post to Slack**

```yaml
jobs:
  notify-slack:
    uses: xema/webhook
    with:
      url: ${{ secrets.SLACK_WEBHOOK_URL }}
      payload:
        text: "Workflow completed: ${{ needs.final.outputs.status }}"
        uploads:
          - title: "Summary"
            text: ${{ needs.final.outputs.summary }}
```

---

## Integration Patterns

### Pattern 1: Git-Based Triggers

Trigger workflows on code changes:

```yaml
on:
  webhook:
    - event: scm.push
      filters:
        branch: main

jobs:
  build:
    uses: xema/agent
    with:
      task: Build and test
      repo_url: ${{ trigger.payload.repo.url }}
      branch: ${{ trigger.payload.branch }}
      commit_sha: ${{ trigger.payload.commit.sha }}
```

Use case: CI/CD pipeline on every push

### Pattern 2: Issue-Driven Workflows

Trigger workflows from issue trackers:

```yaml
on:
  webhook:
    - event: tracker.issue
      filters:
        type: feature
        priority: high

jobs:
  plan-feature:
    uses: xema/agent
    with:
      task: Create feature delivery plan
      issue_key: ${{ trigger.payload.issue.key }}
      title: ${{ trigger.payload.issue.title }}
      requirements: ${{ trigger.payload.issue.description }}
```

Use case: Automated planning from feature requests

### Pattern 3: Multi-Tool Orchestration

Coordinate workflows across multiple external systems:

```yaml
on:
  webhook:
    - event: scm.pull_request
      filters:
        state: opened

jobs:
  review:
    uses: xema/agent
    with:
      pr_url: ${{ trigger.payload.pull_request.url }}
      pr_number: ${{ trigger.payload.pull_request.number }}
      code_diff: ${{ trigger.payload.pull_request.diff }}
    outputs:
      review: ${{ result.review }}

  post-comment:
    needs: review
    uses: xema/webhook
    with:
      url: ${{ trigger.payload.pull_request.comments_url }}
      method: POST
      body:
        body: ${{ needs.review.outputs.review }}

  update-status:
    needs: review
    uses: xema/http
    with:
      url: ${{ trigger.payload.pull_request.status_url }}
      method: POST
      body:
        state: "success"
        description: ${{ needs.review.outputs.status }}
```

---

## Security & Authentication

### API Tokens

All API calls require authentication:

```bash
curl -H "Authorization: Bearer $XEMA_TOKEN" \
  https://workflow-engine-api.xema.dev/workflows/...
```

### Webhook Verification

External providers send **signed webhooks** to prevent spoofing:

```
Header: X-Signature-256 = HMAC-SHA256(secret, body)
```

Xema verifies the signature before processing.

### Secrets in Workflows

Reference secrets securely:

```yaml
jobs:
  deploy:
    uses: xema/http
    with:
      url: https://api.deployment.com/deploy
      headers:
        Authorization: "Bearer ${{ secrets.DEPLOYMENT_TOKEN }}"
```

Secrets are:
- ✅ Encrypted at rest
- ✅ Never logged
- ✅ Audited for access
- ✅ Rotatable

### Permission Scopes

Workflows declare access requirements:

```yaml
permissions:
  repos: read              # Read SCM
  kb: limited             # Limited KB access
  backlog: write          # Full issue tracking
  integrations: read      # Read integrations
```

---

## Idempotency & Retry

### Idempotent Webhook Processing

Each webhook has a deterministic idempotency key:

```
Key = {provider}:{deliveryId}
```

This ensures:
- First delivery: Processed normally
- Duplicate deliveries: Skipped (already processed)
- Failed deliveries: Retried with same key

### Workflow Retry Policy

Configure how failed workflows are retried:

```yaml
defaults:
  retry:
    maxAttempts: 3
    backoffCoefficient: 2.0
    initialInterval: 1s
    maxInterval: 60s
```

### Example: Safe External API Calls

```yaml
jobs:
  call-external:
    retry:
      maxAttempts: 5
    uses: xema/http
    with:
      url: https://api.external.com/process
      body:
        idempotency_key: ${{ trigger.payload.deliveryId }}
```

External API also receives idempotency key, enabling end-to-end safety.

---

## Integration Checklist

When integrating an external system:

- [ ] Declare webhook events in `on.webhook`
- [ ] Add appropriate filters to avoid unwanted triggers
- [ ] Access payload via `${{ trigger.payload.* }}`
- [ ] Use `${{ secrets.* }}` for authentication
- [ ] Include idempotency keys in external calls
- [ ] Handle timeouts gracefully (retry policy)
- [ ] Test with webhook simulation tools
- [ ] Monitor webhook delivery in audit logs
- [ ] Document expected behavior and filters
- [ ] Set up alerts for failed workflows

---

## Examples

### Example 1: GitHub → Code Review

```yaml
name: automatic-code-review
on:
  webhook:
    - event: scm.pull_request
      filters:
        state: opened

jobs:
  analyze:
    uses: xema/agent
    with:
      task: Review pull request code for quality and security
      repo_url: ${{ trigger.payload.repo.url }}
      pr_number: ${{ trigger.payload.pull_request.number }}
      code_diff: ${{ trigger.payload.pull_request.diff }}
    outputs:
      review_comment: ${{ result.review }}

  post-review:
    needs: analyze
    uses: xema/webhook
    with:
      url: ${{ trigger.payload.pull_request.comments_url }}
      method: POST
      body:
        body: ${{ needs.analyze.outputs.review_comment }}
```

### Example 2: Jira → Feature Specification

```yaml
name: jira-to-spec
on:
  webhook:
    - event: tracker.issue
      filters:
        type: feature

jobs:
  generate-spec:
    uses: xema/agent
    with:
      task: Create detailed feature specification
      issue_title: ${{ trigger.payload.issue.title }}
      requirements: ${{ trigger.payload.issue.description }}
      priority: ${{ trigger.payload.issue.priority }}
    outputs:
      spec_id: ${{ result.artifact_id }}

  notify:
    needs: generate-spec
    uses: xema/webhook
    with:
      url: https://notifications.acme.com/webhook
      payload:
        issue_key: ${{ trigger.payload.issue.key }}
        spec_generated: true
        spec_id: ${{ needs.generate-spec.outputs.spec_id }}
```

---

**Next**: Read [Expressions & Data Flow](./03-expressions.md) for details on data passing between jobs.
