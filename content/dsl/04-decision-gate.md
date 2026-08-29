# Decision Gate (`xema/decision-gate`)

The **decision gate** is a built-in workflow action that pauses a run while
one or more **deciders** (humans, agent sessions, or external endpoints)
review pinned artifact versions and produce a binding verdict. Replies
aggregate per a declared policy; downstream consumers (e.g. `xema/publish-kb`)
read the gate's `approvedArtifacts` output directly so the bytes that get
published are exactly the bytes the deciders approved.

---

## When to use it

- A multi-step workflow needs human sign-off before continuing.
- A reviewer LLM should produce an automated verdict on a deliverable.
- An external compliance endpoint must clear a change before it ships.
- A combination of the above with a quorum policy (e.g. "2 of these 3
  must approve").

If you only need a fixed delay (no decision), use [`xema/wait`](./01-reference.md)
instead.

---

## Quick example

Single human reviewer, 24-hour deadline, reject on timeout:

```yaml
jobs:
  approve-requirements:
    needs: [requirements]
    matrixGather: [requirements]
    uses: xema/decision-gate
    with:
      title: Approve requirements
      timeoutSeconds: 86400
      onTimeout: reject
      subjectArtifacts: ${{ needs.requirements.outputs }}
      recipients:
        - kind: human
          target: { userId: ${{ trigger.actorSubject }} }
      policy:
        kind: single
    outputs:
      outcome: ${{ job.outputs.outcome }}

  publish:
    needs: [approve-requirements, requirements]
    if: ${{ needs.approve-requirements.outputs.outcome == 'approved' }}
    uses: xema/publish-kb
    with:
      # The publish step reads the pinned (artifactId, versionId, version, hash)
      # tuple from the gate output. It NEVER picks "latest" — the bytes the
      # deciders approved are the bytes that get published.
      artifactRef: ${{ needs.approve-requirements.outputs.approvedArtifacts[0] }}
```

---

## Inputs

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | yes | Human-readable label shown on the Tasks page card. |
| `timeoutSeconds` | integer | yes | Deadline in seconds (1 to 604800 = 7 days). |
| `onTimeout` | `approve \| reject` | yes | What happens if the policy isn't satisfied before the deadline. |
| `correlationId` | string | yes | Run correlation id for audit. Typically `${{ trigger.correlationId }}`. |
| `inquiryId` | string | optional | Stable id used as the inquiry key. Defaults to a deterministic value derived from the parent workflow + job key. |
| `description` | string | optional | Free-form context shown to humans + included in agent decider prompts. |
| `subjectArtifacts` | array | optional | Upstream job outputs carrying pinned `(artifactId, versionId, version, hash)` references — for an Agent job, its promoted `structuredOutput`. The gate flattens them into the inquiry. Empty/omitted means the gate is wrapping a non-deliverable concern (e.g. a release sign-off without a specific artifact). |
| `recipients` | array (1+) | yes | Who decides. Each entry is a discriminated `{ kind, target }` — see below. |
| `policy` | object | yes | How replies aggregate. See **Reply policies** below. |

### Recipient kinds

#### `human` — a user identified by their identity-system subject

```yaml
recipients:
  - kind: human
    target:
      userId: alice@acme.com
  - kind: human
    target:
      # Special token: resolves at runtime to the user who triggered the run.
      # Not allowed when triggerKind=schedule (no triggering user exists).
      userId: ${{ trigger.actorSubject }}
```

The recipient sees the inquiry on the **Tasks** page (sidebar entry) and
clicks through to the focused decision page where they approve or reject.

#### `agent` — an LLM-driven decider

```yaml
recipients:
  - kind: agent
    target:
      agentRef: senior-reviewer
      invocationConfig:
        # Optional per-recipient overrides — adapter-specific.
        modelTier: precise
```

The agent runs as a peer activity, reviews the pinned subjects, and submits
a structured verdict. Schema-violation in the agent's reply is treated as
ABSTAIN.

#### `endpoint` — an external HTTP check

```yaml
recipients:
  - kind: endpoint
    target:
      url: https://compliance.example.com/api/check
      authRef: service-token-compliance
      timeoutMs: 30000
      verdictMapper:
        # JSONPath into the response body, plus a value→verdict map.
        jsonPath: $.decision
        verdictMap:
          allow: approve
          deny: reject
          unknown: abstain
```

The endpoint receives the pinned subjects + description as a JSON POST body
and returns a verdict via the configured response shape.

---

## Reply policies

| Kind | Win condition | Lose condition |
|---|---|---|
| `single` | First reply wins (any verdict). | n/a |
| `any_of` | First non-abstain reply wins. | n/a |
| `all_of` | All recipients reply approve. | Any recipient rejects. |
| `m_of_n` | At least `m` recipients reply approve. | Remaining recipients can no longer reach `m` approvals. |

`m_of_n` example — 2 of 3 reviewers must approve:

```yaml
policy:
  kind: m_of_n
  m: 2
  # Optional: how agent/endpoint ABSTAIN replies count under the
  # threshold. Default 'skip' treats abstain as a non-vote; the gate
  # waits for the remaining recipients. 'reject_implicit' counts an
  # abstain as a rejection (closes the slot in the no column).
  abstainTreatment: skip
```

The gate **short-circuits** as soon as the outcome is provable:

- `m_of_n` resolves APPROVE the moment `approvedCount >= m`.
- `m_of_n` resolves REJECT the moment `approvedCount + pendingCount < m`
  (quorum is unreachable).
- `all_of` resolves REJECT on the first reject.
- `any_of` / `single` resolve on the first reply.

When the gate resolves, any in-flight non-human decider activities are
cancelled and the corresponding recipient rows transition to `skipped`
with a reason code (`quorum_reached`, `quorum_unreachable`, `all_of_reject`,
`first_reply_resolved`).

---

## Outputs

| Field | Type | Description |
|---|---|---|
| `outcome` | `approved \| rejected \| expired_approved \| expired_rejected \| cancelled` | Terminal outcome. |
| `approvedArtifacts` | array of pinned refs | Non-empty iff `outcome` is `approved` or `expired_approved`. Each entry is `{artifactId, versionId, version, hash}`. |
| `decisionTrail` | array | Per-recipient decision records: `{recipientId, verdict, reason, submittedBy, submittedAtIso}`. |
| `inquiryId` | string | The stable inquiry id (useful for audit cross-references). |

Downstream consumers MUST read the pinned `versionId` from
`approvedArtifacts` rather than picking a "latest" version — this is the
guarantee that the bytes the deciders approved are the bytes that get
published.

---

## Cancellation and timeouts

If the parent run is cancelled (operator clicks "Cancel" on the run-detail
page), the gate workflow is cancelled too: outstanding decider activities
are cancelled, the inquiry is marked `cancelled` (visible on the Tasks
page so reviewers know not to keep deliberating), and the gate's output
is `outcome: cancelled` with an empty `approvedArtifacts`.

If the deadline passes before the policy is satisfied, the gate applies
`onTimeout` (either `approve` or `reject`) and produces
`outcome: expired_approved` or `expired_rejected` accordingly. There is no
recursive escalation in v1 — to chain reviewers, model it as a multi-step
workflow with separate gate jobs.

---

## Common patterns

### Single human approver (the simplest case)

```yaml
- kind: human
  target: { userId: ${{ trigger.actorSubject }} }
policy:
  kind: single
```

### Two humans, either can decide

```yaml
recipients:
  - kind: human
    target: { userId: alice@acme.com }
  - kind: human
    target: { userId: bob@acme.com }
policy:
  kind: any_of
```

### Quorum (2-of-3)

```yaml
recipients:
  - kind: human
    target: { userId: alice@acme.com }
  - kind: human
    target: { userId: bob@acme.com }
  - kind: human
    target: { userId: carol@acme.com }
policy:
  kind: m_of_n
  m: 2
```

### Human + agent reviewer (any one approves)

```yaml
recipients:
  - kind: human
    target: { userId: ${{ trigger.actorSubject }} }
  - kind: agent
    target: { agentRef: senior-reviewer }
policy:
  kind: any_of
```

### Compliance endpoint must clear, plus a human

```yaml
recipients:
  - kind: endpoint
    target:
      url: https://compliance.example.com/check
      authRef: service-token-compliance
      verdictMapper:
        jsonPath: $.decision
        verdictMap:
          allow: approve
          deny: reject
  - kind: human
    target: { userId: ${{ trigger.actorSubject }} }
policy:
  kind: all_of
```

---

**Previous**: [← Troubleshooting](./03-troubleshooting.md)
**Next**: [Review →](./05-review.md)
