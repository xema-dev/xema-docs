# DSL Examples

Ready-to-use workflow examples organized by topic. Each example is complete and runnable.

## Browse by Topic

| Section | Contents |
|---------|----------|
| [General Patterns](./general.md) | Hello world, triggers, matrix, error handling |
| [Interactive Sessions](./agent-sessions.md) | Human + agent collaboration patterns |
| [Pipeline Integration](./pipeline-integration.md) | Multi-job pipelines, data flow, conditional branching |

---

## Quick Reference

### Minimal Workflow (Manual Dispatch)

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: hello-world
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      message:
        type: string
        required: true

jobs:
  greet:
    uses: xema/agent
    with:
      task: ${{ inputs.message }}
```

### Scheduled Workflow

```yaml
on:
  schedule:
    - cron: "0 9 * * MON"
      timezone: "UTC"
      inputs:
        report_type: weekly
```

### Webhook-Triggered

```yaml
on:
  webhook:
    - event: scm.pull_request
      filters:
        state: opened
        targetBranch: main
```

### Session in a Pipeline

```yaml
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
      url: https://api.acme.com/notify
      payload:
        pr_url: ${{ needs.session.outputs.pr_url }}
```

### Conditional Jobs

```yaml
jobs:
  session:
    uses: xema/agent-session
    outputs:
      risk_level: ${{ result.risk_level }}

  review-required:
    needs: session
    if: ${{ needs.session.outputs.risk_level == 'high' }}
    uses: xema/decision-gate
    with:
      approverGroups: [tech-leads]

  auto-proceed:
    needs: session
    if: ${{ needs.session.outputs.risk_level == 'low' }}
    uses: xema/agent
    with:
      task: Proceed automatically
```

### Matrix Expansion

```yaml
jobs:
  test-services:
    strategy:
      matrix:
        service: [auth-api, user-api, catalog-api]
        env: [staging, production]
    uses: xema/agent
    with:
      task: Test ${{ matrix.service }} in ${{ matrix.env }}
```

---

**Full DSL Reference**: [DSL Reference](/docs/dsl/reference.md)  
**Best Practices**: [Best Practices](/docs/dsl/best-practices.md)
