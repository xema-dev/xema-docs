# Examples: Agent Pipeline Integration

These examples show how automated Agent jobs, live Agent Sessions, Decisions, and domain actions compose in one durable Workflow.

## Prepare → collaborate → apply

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: prepare-collaborate-apply
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      requestId:
        type: string
        required: true

jobs:
  prepare:
    uses: xema/agent@2.1.0
    with:
      agentRef: request-analyst@2
      deliverableSpecRef: request-brief@1
      agentContext:
        prompt: Prepare the request evidence and proposed options.
        requestId: ${{ inputs.requestId }}
    outputs:
      brief: ${{ job.outputs.structuredOutput }}

  collaborate:
    needs: [prepare]
    uses: xema/agent@2.1.0
    timeout: 24h
    with:
      agentRef: resolution-coordinator@3
      deliverableSpecRef: resolution-record@1
      agentContext:
        prompt: Work with the responsible person to agree a resolution.
        brief: ${{ needs.prepare.outputs.brief }}
      agentSession: true
    outputs:
      sessionId: ${{ job.outputs.sessionId }}
      resolution: ${{ job.outputs.structuredOutput }}

  apply:
    needs: [collaborate]
    uses: customer/apply-resolution@1.0.0
    with:
      requestId: ${{ inputs.requestId }}
      resolution: ${{ needs.collaborate.outputs.resolution }}
```

## Automated fast path, interactive exception path

```yaml
jobs:
  classify:
    uses: xema/agent@2.1.0
    with:
      agentRef: request-classifier@2
      deliverableSpecRef: request-classification@1
      agentContext:
        prompt: Classify this request and determine whether human guidance is required.
    outputs:
      classification: ${{ job.outputs.structuredOutput }}

  standard-path:
    needs: [classify]
    if: ${{ needs.classify.outputs.classification.requiresHuman == false }}
    uses: xema/agent@2.1.0
    with:
      agentRef: resolution-coordinator@3
      deliverableSpecRef: resolution-record@1
      agentContext:
        prompt: Resolve the standard request within policy.
        classification: ${{ needs.classify.outputs.classification }}

  exception-path:
    needs: [classify]
    if: ${{ needs.classify.outputs.classification.requiresHuman == true }}
    uses: xema/agent@2.1.0
    timeout: 24h
    with:
      agentRef: resolution-coordinator@3
      deliverableSpecRef: resolution-record@1
      agentContext:
        prompt: Resolve this exception with the responsible person.
        classification: ${{ needs.classify.outputs.classification }}
      agentSession: true
```

The same Agent can serve both paths. Policy and risk determine the execution experience; they do not require duplicated Agent definitions.

## Approval before a side effect

```yaml
jobs:
  propose:
    uses: xema/agent@2.1.0
    with:
      agentRef: resolution-coordinator@3
      deliverableSpecRef: action-proposal@1
      agentContext:
        prompt: Prepare the proposed operation and its expected effects.
    outputs:
      proposal: ${{ job.outputs.structuredOutput }}

  approve:
    needs: [propose]
    uses: xema/decision-gate@1.2.0
    with:
      subject: ${{ needs.propose.outputs.proposal }}
      recipients:
        - kind: human
          target:
            userId: ${{ trigger.actorSubject }}
      policy:
        kind: single

  invoke:
    needs: [approve]
    if: ${{ needs.approve.outputs.outcome == 'approved' }}
    uses: customer/perform-approved-operation@1.0.0
    with:
      proposal: ${{ needs.propose.outputs.proposal }}
```

The Agent proposes, the Decision records authority, and the domain action performs the side effect.

See [Workflow-linked Agent Sessions](./agent-sessions.md) and [Agent Step](../06-agent-step.md).
