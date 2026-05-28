# `reviewer-output` — Reviewer agent contract

The uniform output contract every reviewer agent dispatched by the
`xema/review` primitive must produce. The review workflow injects
this `deliverableSpecRef` into every agent invocation it dispatches
(mandatory or advisory), and the existing harvest path validates against
it. A schema violation surfaces as `abstain` to the gate — never as
silent acceptance.

## When this spec applies

- Every recipient of kind `agent` inside a `xema/review` reviewer
  pool. The review workflow appends `deliverableSpecRef: reviewer-output`
  to the agent invocation regardless of which agent slug is used. Any
  agent that can produce this shape can serve as a reviewer.
- It does **not** apply to:
  - Direct `xema/decision-gate` recipients (those use
    `decision-gate-reply` reply schemas).
  - Workflow recipients (`kind: workflow` — they map outputs through
    `verdictMapper`, not through this spec).
  - Endpoint recipients (verdict mapping happens in `verdictMapper`).
- It does not gate human reviewers — humans submit verdicts through the
  Tasks UI and never write a deliverable.

## Schema

`schema.zod.ts` (canonical):

```ts
const ReviewerFindingSeveritySchema = z.enum([
  'critical', 'major', 'minor', 'info',
]);

const ReviewerFindingSchema = z.object({
  severity: ReviewerFindingSeveritySchema,
  area: z.string().min(1),
  message: z.string().min(1),
});

const ReviewerVerdictSchema = z.enum(['approve', 'reject', 'abstain']);

const ReviewerAgentOutputSchema = z.object({
  verdict: ReviewerVerdictSchema,
  summary: z.string().min(1),
  findings: z.array(ReviewerFindingSchema),
  suggestedEdits: z.array(z.string().min(1)).optional(),
});
```

## Field semantics

| Field | Required | Notes |
|---|---|---|
| `verdict` | yes | Closed set: `approve` (vote yes), `reject` (vote no), `abstain` (no opinion). Subject to the recipient's `mandatory` bit on the gate. |
| `summary` | yes | Single-paragraph rationale. Surfaces in the human reviewer's findings panel and in the per-iteration trail. |
| `findings` | yes (may be empty) | Structured issues. `area` is open-ended (e.g. `"security"`, `"naming"`, `"performance"`) — the contract does not impose a closed taxonomy. |
| `suggestedEdits` | optional | Concrete change suggestions surfaced to the next-iteration drafter as `priorReviewerFeedback` / `pastIterations[].reviewerVerdicts`. |

## Verdict semantics under `xema/review`

- `approve` and `reject` count toward policy resolution iff the
  recipient is `mandatory: true`. Advisory recipients still emit them
  but don't gate.
- `abstain` is a non-vote. The review workflow records it but never
  short-circuits on it.
- Repeated `reject` from an agent is what drives the loop's
  `agentMaxIterations` demotion; `abstain` does not count toward that
  threshold.

## Why this is a kernel-tier spec

`xema/review` is a first-party platform primitive — every install
that ever uses review needs this contract. It therefore ships in
`biomes/kernel/runtime/deliverable-specs/specs/schema/reviewer-output/`
alongside the other always-on kernel content (workspace manifests,
agent runtime tools, mcp catalog, role capabilities). Biomes are free to
introduce richer review contracts for their own actions, but those are
biome concerns, not platform ones.
