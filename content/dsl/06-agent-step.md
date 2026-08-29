# Agent Step (`xema/agent@2.1.0`)

The Agent step runs a published Xema Agent in a governed workspace. The Agent reference is the single source of truth for the Agent definition, its recursive sub-agent tree, Skills, tools, model defaults, and workspace layout.

For the broader workflow grammar, see [DSL Reference](./01-reference.md).

---

## Minimal usage

```yaml
jobs:
  draft-spec:
    uses: xema/agent@2.1.0
    with:
      agentRef: requirements@3
      deliverableSpecRef: feature-spec@2
      agentContext:
        prompt: Draft a feature specification from the supplied request.
```

`agentRef`, `deliverableSpecRef`, and `agentContext` are required keys. Use `deliverableSpecRef: null` when the invocation does not need a typed deliverable.

---

## Core inputs

### `agentRef` *(required)*

A bare Agent slug or a pinned `slug@version` reference. A bare slug resolves to the latest published revision; a versioned reference makes the workflow reproducible against that exact revision.

The workflow does not separately select a workspace manifest. Workspace composition is owned by the resolved Agent.

### `deliverableSpecRef` *(required, nullable)*

The contract for the structured output the Agent must produce. An unknown literal reference fails validation. Set the field to `null` for an invocation that does not require a typed deliverable.

### `agentContext` *(required)*

A context object supplied to the Agent. Use `prompt` for the invocation-specific instruction and add domain fields when the Agent expects them.

```yaml
with:
  agentRef: risk-reviewer@4
  deliverableSpecRef: risk-assessment@2
  agentContext:
    prompt: Review the proposed change and identify material risks.
    changeId: ${{ inputs.change_id }}
    severityFloor: medium
```

---

## Optional execution controls

### `model`

Override the Agent's normal model resolution for this job. Prefer a strategy when the organisation should be able to change the concrete provider or model centrally.

```yaml
with:
  model:
    kind: strategy
    modelClass: review # coding | review | creative | planning | utility
    temperature: 0.2
```

A concrete pin is also supported:

```yaml
with:
  model:
    kind: concrete
    modelId: provider/model-id
    providerSlug: provider
    temperature: 0.2
```

### `subAgents`

Add invocation-specific sub-agent bindings to the resolved Agent's intrinsic delegates. Each binding names a sub-agent slug and may assign an alias or model override.

```yaml
with:
  subAgents:
    - slug: policy-researcher
    - slug: data-reviewer
      alias: evidence-reviewer
      modelOverride:
        kind: strategy
        modelClass: review
```

For recursive composition limits, use `composition.limits`; `composition.allowedSubAgents` can narrow which delegates the coordinator may invoke.

```yaml
with:
  composition:
    limits:
      maxDepth: 3
      maxFanout: 4
      maxSpawns: 16
    allowedSubAgents: [policy-researcher, data-reviewer]
```

### `agentSession`

Set `agentSession: true` to turn the Agent job into a workflow-linked, real-time human collaboration point. Xema opens a Session, sends `agentContext.prompt` as the first turn, keeps the workflow durable while people collaborate, and resumes when the Session produces its structured handoff.

```yaml
jobs:
  resolve-exception:
    uses: xema/agent@2.1.0
    timeout: 24h
    with:
      agentRef: operations-coordinator@5
      deliverableSpecRef: exception-resolution@2
      agentContext:
        prompt: Investigate this exception with the operator and propose a resolution.
        caseId: ${{ inputs.case_id }}
      agentSession: true
```

The `sessionId` output is populated for this branch so a product surface can deep-link to the conversation. Use a generous job timeout because the human interaction may take hours.

### Inquiries and resumption

- `allowAgentToolInquiries` enables in-band questions from tools.
- `toolInquiryRecipients` and `toolInquiryPolicy` define who may answer and how answers are combined.
- `resumeFrom` names a prior Agent Session when a coordinator must resume the same conversational state after a gate.

---

## Outputs

The current Agent action exposes:

| Output | Meaning |
|---|---|
| `allocationId` | Runtime allocation used for the job |
| `outcome` | `succeeded`, `empty-response`, or `partial` |
| `structuredOutput` | The Agent's structured handoff, promoted to a `json_payload` artifact reference |
| `agentResult` | The same handoff, unpromoted |
| `response` | Declared as a `markdown_doc` promotion; always `null` today |
| `deliverables` | Declared, but always empty — nothing harvests the Agent workspace |
| `durationMs` | Execution duration |
| `sessionId` | Workflow-linked Session id |
| `workspaceId` | Durable Workspace a later Agent job may attach to |

`structuredOutput` is the one artifact an Agent job produces. There is no
singular `deliverable` output — `job.outputs.deliverable` does not resolve. See
[the deliverables note](../deliverables/index.md).

Declare job outputs from the fields the workflow needs:

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
```

---

## See also

- [Interactive Sessions](../interactive-sessions/index.md)
- [Sub-agents](../interactive-sessions/04-sub-agents.md)
- [Deliverable specifications](../deliverables/index.md)
- [Best Practices](./02-best-practices.md)

---

**Previous**: [← Review Step](./05-review.md)
**Next**: [Dispatch Workflow →](./07-dispatch-workflow.md)
