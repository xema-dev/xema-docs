# Examples: Workflow-linked Agent Sessions

An interactive collaboration point is a normal `xema/agent@2.1.0` job with `agentSession: true`. The same published Agent can therefore run autonomously or collaborate with people without introducing a second Agent definition or a separate Session action.

---

## Minimal interactive Agent job

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: guided-exception-resolution
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      caseId:
        type: string
        required: true

jobs:
  resolve:
    uses: xema/agent@2.1.0
    timeout: 24h
    with:
      agentRef: operations-coordinator@5
      deliverableSpecRef: exception-resolution@2
      agentContext:
        prompt: Work with the operator to investigate and resolve this exception.
        caseId: ${{ inputs.caseId }}
      agentSession: true
    outputs:
      sessionId: ${{ job.outputs.sessionId }}
      resolution: ${{ job.outputs.structuredOutput }}
```

Xema opens the Session, sends the prompt as the first turn, and keeps the workflow job durable until the Session produces its structured handoff. The `sessionId` allows an experience to open the live conversation.

---

## Prepare, collaborate, then continue

```yaml
jobs:
  prepare:
    uses: xema/agent@2.1.0
    with:
      agentRef: case-analyst@3
      deliverableSpecRef: case-brief@2
      agentContext:
        prompt: Prepare the evidence and unresolved questions for this case.
        caseId: ${{ inputs.caseId }}
    outputs:
      brief: ${{ job.outputs.structuredOutput }}

  collaborate:
    needs: [prepare]
    uses: xema/agent@2.1.0
    timeout: 24h
    with:
      agentRef: operations-coordinator@5
      deliverableSpecRef: exception-resolution@2
      agentContext:
        prompt: Review the prepared brief with the operator and agree the resolution.
        caseId: ${{ inputs.caseId }}
        brief: ${{ needs.prepare.outputs.brief }}
      agentSession: true
    outputs:
      sessionId: ${{ job.outputs.sessionId }}
      resolution: ${{ job.outputs.structuredOutput }}

  record:
    needs: [collaborate]
    uses: customer/case-record-resolution@1.0.0
    with:
      caseId: ${{ inputs.caseId }}
      resolution: ${{ needs.collaborate.outputs.resolution }}
```

The preparation and recording jobs remain automated. Only the job that benefits from human judgement becomes interactive.

---

## Decision gate before collaboration

Use a Decision when the workflow needs explicit authority before opening or continuing a human-guided operation:

```yaml
jobs:
  propose:
    uses: xema/agent@2.1.0
    with:
      agentRef: risk-reviewer@4
      deliverableSpecRef: action-proposal@1
      agentContext:
        prompt: Prepare a bounded action proposal for this request.
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

  execute-with-operator:
    needs: [approve]
    if: ${{ needs.approve.outputs.outcome == 'approved' }}
    uses: xema/agent@2.1.0
    timeout: 24h
    with:
      agentRef: operations-coordinator@5
      deliverableSpecRef: execution-record@1
      agentContext:
        prompt: Execute the approved proposal with the operator.
        approvedProposal: ${{ needs.propose.outputs.proposal }}
      agentSession: true
```

The Decision owns the approval evidence; the Agent Session owns the collaborative execution; the Workflow owns the durable sequence.

---

## Design guidance

- Use the same `agentRef` for automated and interactive execution when the responsibility is the same.
- Pin `agentRef` and `deliverableSpecRef` versions for reproducible production workflows.
- Give interactive jobs a timeout that reflects human response time.
- Carry business state through typed deliverables rather than relying on transcript parsing.
- Use the `sessionId` to deep-link from the workflow run into the collaboration surface.

See [Agent Step](../06-agent-step.md) and [Interactive Sessions](../../interactive-sessions/index.md).
