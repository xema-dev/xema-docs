# DSL Examples

Current workflow examples organised by execution pattern.

## Browse by topic

| Section | Contents |
|---|---|
| [General Patterns](./general.md) | Triggers, schedules, matrices, conditions, and error handling |
| [Workflow-linked Agent Sessions](./agent-sessions.md) | Human and Agent collaboration inside a durable Workflow |
| [Pipeline Integration](./pipeline-integration.md) | Automated paths, interactive exception paths, Decisions, and side effects |

## Minimal Agent workflow

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: assess-request
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      request:
        type: string
        required: true

jobs:
  assess:
    uses: xema/agent@2.1.0
    with:
      agentRef: request-analyst@2
      deliverableSpecRef: request-assessment@1
      agentContext:
        prompt: ${{ inputs.request }}
```

## Scheduled workflow

```yaml
on:
  schedule:
    - cron: "0 9 * * MON"
      timezone: UTC
      inputs:
        reportType: weekly
```

## Webhook-triggered workflow

```yaml
on:
  webhook:
    - event: customer.case.opened
      filters:
        priority: high
```

## Live Session inside a workflow

```yaml
jobs:
  collaborate:
    uses: xema/agent@2.1.0
    timeout: 24h
    with:
      agentRef: operations-coordinator@5
      deliverableSpecRef: resolution-record@1
      agentContext:
        prompt: Work with the operator to resolve this exception.
      agentSession: true
    outputs:
      sessionId: ${{ job.outputs.sessionId }}
      resolution: ${{ job.outputs.structuredOutput }}
```

## Conditional paths

```yaml
jobs:
  assess:
    uses: xema/agent@2.1.0
    with:
      agentRef: risk-reviewer@4
      deliverableSpecRef: risk-assessment@2
      agentContext:
        prompt: Assess the request.
    outputs:
      assessment: ${{ job.outputs.structuredOutput }}

  review-required:
    needs: [assess]
    if: ${{ needs.assess.outputs.assessment.risk == 'high' }}
    uses: xema/decision-gate@1.2.0
    with:
      subject: ${{ needs.assess.outputs.assessment }}
      recipients:
        - kind: human
          target:
            userId: ${{ trigger.actorSubject }}
      policy:
        kind: single
```

## Matrix expansion

```yaml
jobs:
  assess-regions:
    strategy:
      matrix:
        region: [eu-west, eu-central, eu-north]
      maxParallel: 3
    uses: xema/agent@2.1.0
    with:
      agentRef: regional-reviewer@2
      deliverableSpecRef: regional-assessment@1
      agentContext:
        prompt: Assess the operating posture for ${{ matrix.region }}.
```

See [Agent Step](../06-agent-step.md) for the current action contract.
