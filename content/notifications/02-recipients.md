# Recipients

When a workflow needs an answer — an approval, a verdict, a reviewed result — it raises an **inquiry**. The inquiry's `recipients[]` list says *who* (or *what*) is being asked. Each recipient kind describes a different way to produce a reply, but the engine treats them uniformly: every reply has the same shape, regardless of who answered.

---

## Recipient kinds

| Kind | What it addresses | How it answers |
|---|---|---|
| `human` | A specific user | The user submits a reply via the tasks UI. Generates a notification for that user. |
| `agent` | A non-human decider | A single Xema agent run produces a structured verdict. No user notification — the engine drives it. |
| `endpoint` | An external HTTP endpoint | The engine POSTs the inquiry, parses the response, and maps it to a verdict. No user notification. |
| `identity-group` | An identity group (resolved to humans) | Authoring-time alias. Expands to N `human` recipients at inquiry-create time. |
| `workflow` | A child Xema workflow | Engine dispatches the workflow as a top-level run, awaits termination, maps `outputs` to a verdict via `verdictMapper` (or reads `outputs.verdict`). No user notification. |

The reply contract is uniform: every recipient row produces a `{ verdict, payload? }` regardless of how it was generated. Reply policies (`single`, `m_of_n`, `all_of`, `any_of`) apply identically across kinds.

---

## Snapshot semantics

Group expansion is **snapshot-at-create**. When an inquiry is created with an `identity-group` recipient, the engine resolves the group's current members to concrete `human` recipients and persists them. Adding or removing members from the group later does **not** change the inquiry — it stays directed at the people who were members when it was raised.

This avoids the "approval changed who could decide it half-way through" footgun and keeps audit trails meaningful.

---

## Authoring example

```yaml
- name: collect-approvals
  uses: xema/decision-gate
  with:
    title: "Sign off on the new compliance policy"
    recipients:
      # Direct user
      - kind: human
        target:
          userId: ${{ trigger.user.id }}

      # Reusable group of users (resolved at create time)
      - kind: identity-group
        target:
          groupId: ${{ vars.SECURITY_CHAMPIONS_GROUP_ID }}

      # Automated reviewer
      - kind: agent
        target:
          agentRef: compliance-reviewer

    policy:
      kind: m_of_n
      m: 2
```

The decision gate aggregates replies from every kind under one policy. A human approval, an agent abstain, and a group member's reject all flow through the same `m_of_n` math.

---

## Concept separation

Recipients describe *who answers*. Notifications describe *who needs to see something*. They overlap for `human` recipients (and humans expanded from `identity-group`) but diverge cleanly:

- An `agent` recipient does **not** generate a notification — it produces an agent run that calls back with a verdict.
- An `endpoint` recipient does **not** generate a notification — it produces an HTTP exchange.
- A `workflow` recipient does **not** generate a notification — it produces a child workflow.

Only `human` (after group expansion) produces a notification row. This keeps the bell badge correct: it counts things humans actually need to do.

---

## Workflow recipients — verdict mapping

A `workflow` recipient runs another workflow as a non-human responder. The engine starts it as a top-level run, polls until it terminates, then turns its outputs into a verdict.

**Default contract (no `verdictMapper`)**: the responder workflow exposes a top-level `verdict` field whose value is one of `approve | reject | abstain`. The dispatcher reads it directly.

```yaml
- kind: workflow
  target:
    workflowSlug: compliance-review
    inputs:
      changeUnitId: ${{ ctx.changeUnit.id }}
```

**Custom mapping (`verdictMapper`)**: project arbitrary outputs onto a verdict. Each branch is a bounded expression evaluated against the responder's flattened outputs; the first truthy branch wins.

```yaml
- kind: workflow
  target:
    workflowSlug: compliance-review
    inputs:
      policyVersion: 'v3'
    verdictMapper:
      approve: 'outputs.compliant === true'
      reject:  'outputs.compliant === false'
```

Supported expression forms (closed grammar — anything else fails at inquiry-create with `INQUIRY_VERDICT_MAPPER_INVALID`):

- `outputs.path.to.field` — truthy test
- `outputs.path === <literal>` / `outputs.path !== <literal>` — strict (in)equality
- Literals: `true`, `false`, `null`, `"string"`, `<number>`

**Cycle detection**: workflows can't recurse infinitely. If the dispatched slug is already on the responder chain (parent run + every ancestor that triggered it), creation fails with `INQUIRY_RESPONDER_CYCLE`. The chain is forwarded through every level so deep recursion is caught at the earliest opportunity, not after burning a chain of dispatches.

**Failure modes** — every path produces a typed `ABSTAIN` reply rather than a stuck recipient:

- Child run terminated with `failed` / `cancelled` → `ABSTAIN, reason: child_<status>`.
- `verdictMapper` produced no truthy branch → `ABSTAIN, reason: no_verdict_branch_matched`.
- Default mode and `outputs.verdict` is missing or invalid → `ABSTAIN, reason: verdict_field_missing` / `verdict_field_invalid:<value>`.

The gate's `abstainTreatment` (default `skip`) decides what an abstain means for the policy.

---

**Previous**: [← Overview](./01-overview.md)
**Next**: [Groups →](./03-groups.md)
