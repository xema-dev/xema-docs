# Review (`xema/review`)

The **review action** is a built-in workflow action that runs a reviewer
pool over one or more artifacts and (optionally) loops a producer step
until the artifacts are approved. It composes the [decision
gate](./04-decision-gate.md) under the hood: each iteration dispatches
one fresh decision-gate inquiry, the verdicts feed back into the loop,
and on reject the producer can be re-dispatched with the prior reviewer
feedback merged into its agent context.

Three authoring shapes are supported, each with the same primitive:

1. **Redraft loop** — `subject` + `redraft.step`. Reviewers vote on the
   producer's output; reject re-dispatches the producer; loop until
   approve or all reviewers exhaust.
2. **Terminal review** — `subject` only. Reviewers vote once; reject
   exits with `outcome: rejected` and downstream branching takes over
   (use this when the artifact comes from outside the workflow — SCM
   PR, uploaded doc — and there is nothing to redraft).
3. **Approval-to-proceed gate** — neither `subject` nor `redraft`.
   Reviewers vote yes/no on a question with no artifact attached
   (release sign-off, deploy approval, …).

---

## When to use it

- A draft → review → fix → re-review loop with a producer that can be
  re-dispatched on reject.
- An artifact that comes from outside the workflow needs sign-off (PR
  review, externally-uploaded doc).
- A multi-stakeholder approval where reviewers must justify their
  verdict.
- A go/no-go decision gate (no artifact, just a yes/no).

If you need to pin specific artifact versions through approval (the
caller wants the pinned `(artifactId, versionId, version, hash)` tuple
in the gate's output for downstream `xema/publish-kb`), use
[`xema/decision-gate`](./04-decision-gate.md) directly instead. The
review action surfaces a free-form `subject` and is not tied to the
artifact-pinning model.

---

## Quick examples

### Redraft loop

A producer agent drafts requirements; one human + one agent reviewer
vote `all_of`. On reject, the producer re-runs with reviewer feedback
in `agentContext.review`. The agent reviewer is auto-demoted to
advisory after 3 rejects so a stuck unanimous-reject pool can never
block the human approver.

```yaml
jobs:
  draft:
    uses: xema/agent
    with:
      agentRef: requirements-writer
      deliverableSpecRef: requirements-standard
      agentContext:
        prompt: "Write requirements for the requested feature."

  review:
    needs: [draft]
    uses: xema/review
    with:
      subject: ${{ needs.draft.outputs.deliverables }}
      redraft: { step: draft }
      reviewers:
        - kind: agent
          target: { agentRef: requirements-reviewer }
          mandatory: true
          agentMaxIterations: 3
        - kind: human
          target: { userId: ${{ trigger.actorSubject }} }
          mandatory: true
      policy: { kind: all_of }
      iterationTimeoutSeconds: 86400
      onIterationTimeout: reject
    outputs:
      outcome: ${{ job.outputs.outcome }}
      finalDraft: ${{ job.outputs.finalDraft }}
```

### Terminal review (PR-style — no in-loop redraft)

The artifact arrives from outside the workflow. Reject ends the run;
downstream branching reacts.

```yaml
jobs:
  review-pr:
    uses: xema/review
    with:
      subject: ${{ inputs.prUrl }}
      reviewers:
        - kind: human
          target: { userId: ${{ inputs.author }} }
          mandatory: true
      policy:
        kind: single
        requireReason: on_reject
      iterationTimeoutSeconds: 86400
      onIterationTimeout: reject
    outputs:
      outcome: ${{ job.outputs.outcome }}
      summary: ${{ job.outputs.summary }}

  notify-rejected:
    needs: [review-pr]
    if: ${{ needs.review-pr.outputs.outcome == 'rejected' }}
    uses: xema/scm-post-review
    with:
      url: ${{ inputs.prUrl }}
      verdict: changes-requested
      body: ${{ needs.review-pr.outputs.summary }}
```

### Approval-to-proceed gate

No artifact. Reviewers say yes or no.

```yaml
jobs:
  approve-release:
    uses: xema/review
    with:
      subject: null      # or omit entirely
      reviewers:
        - kind: human
          target: { userId: ${{ vars.releaseManager }} }
          mandatory: true
      policy:
        kind: single
        requireReason: always
      iterationTimeoutSeconds: 86400
      onIterationTimeout: reject
```

---

## Inputs

| Field | Type | Required | Description |
|---|---|---|---|
| `reviewId` | string | optional | Stable id used as the per-iteration inquiry id prefix. Auto-injected as `<runId>:<jobKey>:<matrixIndex>` when omitted. |
| `subject` | string OR array of strings | optional | Artifact(s) under review. Each entry is an arbitrary expression (typically `${{ needs.<step>.outputs.deliverables }}`). Omit for an approval-to-proceed gate. |
| `redraft` | object | optional | Producer step to re-dispatch on reject. Shape `{ step: <stepName> }`. Requires `subject` to be set. Omit for terminal reviews. |
| `reviewers` | array (1+) | yes | Reviewer pool — humans, agents, endpoints, identity groups, sub-workflows. See **Reviewer kinds** below. |
| `policy` | object | yes | Aggregation policy. See **Reply policies** below. |
| `iterationTimeoutSeconds` | integer | yes | Per-iteration deadline (1–604800). Same semantics as decision-gate's `timeoutSeconds`. |
| `onIterationTimeout` | `approve \| reject \| escalate` | yes | What happens when an iteration's deadline elapses. |
| `escalation` | object | optional | Recipients added when all mandatory reviewers exhaust without approving. Shape `{ recipients: [...], timeoutSeconds: int }`. |

### `subject` shape

The most common pattern is a single expression resolving to a producer
step's deliverables:

```yaml
subject: ${{ needs.draft.outputs.deliverables }}
```

For multi-deliverable reviews (one decision spans several artifacts),
pass an array:

```yaml
subject:
  - ${{ needs.draft-spec.outputs.deliverables }}
  - ${{ needs.draft-design.outputs.deliverables }}
```

### `redraft.step` rules

The compiler validates `redraft.step` at compile time:

- The named step must exist in the same workflow.
- The named step must use `xema/agent@<semver>` (the only producer
  shape currently supported).
- The named step must be in this review step's `needs:`.
- The named step cannot itself use a matrix strategy (redraft of one
  matrix entry is not defined).
- `redraft` requires `subject` to be set.

The compiler **auto-extends** the review step's `needs:` with the
producer step's transitive needs, so any `${{ needs.* }}` expression
the producer's `with:` references resolves at dispatch.

### Reviewer kinds

Identical to [decision-gate recipients](./04-decision-gate.md#recipient-kinds):
`human`, `agent`, `endpoint`, `workflow`, `identity_group`. Plus two
review-specific fields per recipient:

| Field | Type | Default | Description |
|---|---|---|---|
| `mandatory` | boolean | `true` | When `false`, the recipient's verdict is recorded but does not gate. Useful for advisory reviewers. |
| `agentMaxIterations` | integer | unbounded | Agent / workflow recipients only. After this many rejects from the same recipient, it is auto-demoted to advisory for the rest of the loop. Caps stuck-loop scenarios. |

```yaml
reviewers:
  - kind: agent
    target: { agentRef: gate-reviewer-architecture }
    mandatory: true
    agentMaxIterations: 3
  - kind: agent
    target: { agentRef: gate-reviewer-style }
    mandatory: false        # Advisory — voice without veto.
  - kind: human
    target: { userId: ${{ trigger.actorSubject }} }
    mandatory: true         # Humans always mandatory; never demoted.
```

---

## Reply policies

Same shape as the decision gate, plus an optional `requireReason`:

| Kind | Win condition | Lose condition |
|---|---|---|
| `single` | First reply wins. | n/a |
| `any_of` | First non-abstain reply wins. | n/a |
| `all_of` | All mandatory recipients reply approve. | Any mandatory recipient rejects. |
| `m_of_n` | At least `m` mandatory recipients approve. | Remaining mandatory recipients can no longer reach `m`. |

Advisory recipients (those with `mandatory: false`) do not gate the
policy — their verdicts are still recorded and shown to other reviewers
on the next iteration.

### `requireReason`

Closed enum, defaults to `on_reject`:

| Value | Behavior |
|---|---|
| `always` | Every verdict (approve, reject, abstain) requires a `reason`. |
| `on_reject` | Only reject and abstain require a reason. |
| `never` | Reason is optional on every verdict. |

The verdict UI on the Tasks page enforces this in the human form. Agent
and endpoint deciders that omit a required reason are treated as
ABSTAIN.

---

## Iteration mechanics

Each iteration is a fresh decision-gate inquiry with a stable id of
`<reviewId>:iter:<N>`. The flow:

1. **Resolve the draft.** Iter 1 uses the resolved `subject` directly
   (no producer call — the standalone draft step ran upstream). Iter 2+
   re-dispatches the `redraft` action with the prior reviewer feedback
   in `agentContext.review.priorReviewerFeedback`.
2. **Apply demotion.** Each agent / workflow reviewer in the demoted
   set flips to `mandatory: false`.
3. **Check exhaustion.** If no mandatory reviewer remains, apply
   `escalation` if configured; else terminate as `outcome: exhausted`.
4. **Run the gate.** Dispatch the decision-gate child workflow.
5. **Branch on the verdict.**
   - `approved` / `expired_approved` → return `outcome: approved`.
   - `expired_rejected` → return `outcome: expired`.
   - `cancelled` → return `outcome: cancelled`.
   - `rejected` with `redraft` set → bump per-recipient reject
     counters, demote any that hit `agentMaxIterations`, loop.
   - `rejected` without `redraft` (terminal review) → return
     `outcome: rejected`.

The loop boundary uses `continueAsNew` every 25 iterations to keep
runtime history bounded under runaway human-driven loops.

---

## Outputs

| Field | Type | Description |
|---|---|---|
| `outcome` | `approved \| rejected \| expired \| exhausted \| cancelled` | Terminal outcome. |
| `subjects` | array | Resolved subjects mirrored from input. Empty for approval-to-proceed gates. |
| `iterations` | integer | Number of iterations actually run (always ≥ 1). |
| `summary` | string | Aggregated reviewer-side summary from the final iteration's verdicts (one line per reviewer with `verdict` + optional `reason`). Suitable for posting back to the source system (e.g. as an SCM review comment via `xema/scm-post-review`). |
| `finalDraft` | object | The artifact reviewed in the final iteration. For iter-1 approval, it is the resolved subject (with a `deliverables` alias unwrapped from the standard `subject: ${{ ...outputs.deliverables }}` pattern). For iter-N approval, it is the redraft producer's output — same shape as `xema/agent`'s outputs. Absent on approval-to-proceed gates. |
| `decisionTrail` | array | Per-iteration record `{ iteration, draft, reviewerVerdicts, demotedAgents }`. |

Downstream consumers reading `finalDraft.deliverables` work on every
approval iteration when authors follow the standard
`subject: ${{ needs.<step>.outputs.deliverables }}` or
`subject: ${{ needs.<step>.outputs }}` patterns.

---

## Cancellation, timeouts, and escalation

- **Cancellation.** When the parent run is cancelled, the review
  workflow propagates cancellation to the in-flight decision-gate
  iteration; the inquiry transitions to `cancelled` (visible on the
  Tasks page so reviewers stop deliberating); the review's output is
  `outcome: cancelled` with the partial `decisionTrail`.
- **Iteration timeout.** Each iteration's `iterationTimeoutSeconds`
  controls only the human-gate window for that iteration. Timeout
  applies the configured `onIterationTimeout` action; the loop does
  not implicitly retry.
- **Reviewer exhaustion.** If every mandatory reviewer is demoted to
  advisory and no escalation is configured, the workflow returns
  `outcome: exhausted`. With `escalation` set, the listed recipients
  are added to the pool for the next iteration; the loop continues.

---

## Common patterns

### Mixed reviewers with redraft

Three agents (architecture, quality, governance) plus one human under
`all_of`. Each agent demoted after 3 rejects.

```yaml
review:
  needs: [synthesize]
  uses: xema/review
  with:
    subject: ${{ needs.synthesize.outputs.deliverables }}
    redraft: { step: synthesize }
    reviewers:
      - { kind: agent, target: { agentRef: gate-reviewer-architecture }, mandatory: true, agentMaxIterations: 3 }
      - { kind: agent, target: { agentRef: gate-reviewer-quality }, mandatory: true, agentMaxIterations: 3 }
      - { kind: agent, target: { agentRef: gate-reviewer-governance }, mandatory: true, agentMaxIterations: 3 }
      - { kind: human, target: { userId: ${{ trigger.actorSubject }} }, mandatory: true }
    policy: { kind: all_of }
    iterationTimeoutSeconds: 86400
    onIterationTimeout: reject
```

### Multi-deliverable review

One decision spans the spec + the design doc.

```yaml
review:
  needs: [draft-spec, draft-design]
  uses: xema/review
  with:
    subject:
      - ${{ needs.draft-spec.outputs.deliverables }}
      - ${{ needs.draft-design.outputs.deliverables }}
    # No redraft when multiple producers are involved — handle reject
    # by failing the workflow or branching downstream and re-running
    # the upstream producers as a separate dispatch.
    reviewers:
      - { kind: human, target: { userId: ${{ trigger.actorSubject }} }, mandatory: true }
    policy: { kind: single }
    iterationTimeoutSeconds: 86400
    onIterationTimeout: reject
```

### m_of_n quorum

Three reviewers, two must approve.

```yaml
policy:
  kind: m_of_n
  m: 2
  abstainTreatment: skip
```

### Required justification on every verdict

```yaml
policy:
  kind: single
  requireReason: always
```

### Escalation when reviewers exhaust

```yaml
escalation:
  recipients:
    - kind: identity_group
      target: { groupId: ${{ vars.SECURITY_CHAMPIONS }} }
      mandatory: true
  timeoutSeconds: 86400
```

---

## How it differs from the decision gate

|  | `xema/review` | `xema/decision-gate` |
|---|---|---|
| Loop on reject | Yes (when `redraft` is set) | No (single inquiry) |
| `subject` shape | Free-form (string / array of any expression) | Pinned `subjectArtifacts` (artifactId+versionId+version+hash) |
| Output shape | `outcome` + `subjects` + `summary` + `finalDraft` + `decisionTrail` | `outcome` + `approvedArtifacts` (pinned) + `decisionTrail` |
| `requireReason` | Yes | No (always optional) |
| Reviewer demotion (`agentMaxIterations`) | Yes | No |
| `xema/publish-kb` integration | Read `finalDraft.deliverables` from the FINAL APPROVED iteration | Read pinned `approvedArtifacts[*]` directly |

Use the **decision gate** when downstream needs the pinned-version
guarantee (the bytes the deciders approved are the bytes that get
published). Use the **review action** when you want a redraft loop, a
free-form subject, or an approval-to-proceed gate.

---

**Previous**: [← Decision Gate](./04-decision-gate.md)
