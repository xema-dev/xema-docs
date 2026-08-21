# Validation and self-correction

When an agent finishes its session, the runtime harvests the workspace and runs the deliverable spec's output contract against the result. If validation fails, the runtime gives the agent exactly one structured retry inside the same agent session before failing the activity.

---

## What the runtime checks

Each kind has a deterministic validation rule:

| Kind | Validation |
|---|---|
| `document-template` | At least one rendered page; every `multiPage.pages[].slug` has a corresponding artifact |
| `json-schema` / `zod-schema` / `structured-json` | A parseable JSON value present; matches the declared schema (Ajv / Zod) |
| `endpoint-fetch` | A non-null payload was harvested |
| `custom` | At least one file in the target slot |
| `response-only` | A non-empty assistant message in the session's final turn |

Validation runs immediately after harvest. The result is either `null` (valid — return the envelope) or a structured `DeliverableValidationFailure` with typed reasons.

## Typed reasons

Failures carry one or more reasons drawn from a closed set:

| Code | Meaning |
|---|---|
| `MISSING_FILE` | A file declared in `outputContract.files[]` wasn't found |
| `MISSING_PAGE` | A `multiPage.pages[]` entry has no rendered artifact |
| `SCHEMA_VIOLATION` | JSON parsed but failed schema validation (Ajv path included) |
| `MALFORMED_JSON` | Required JSON file didn't parse |
| `EMPTY_RESPONSE` | Response-only spec but the agent produced no assistant text |
| `WRONG_TARGET_SLOT` | Files emitted to the wrong workspace slot (deliverables vs repos) |
| `HARVEST_ERROR` | Mechanical harvester failure (proxy 5xx, network) |

## The self-correction loop

The first validation failure triggers a single, structured correction attempt:

1. **Emit `validation-failed`** — a CloudEvent carrying `expected`, `actual`, `reasons`, and `agentFinalMessage`. The run-detail UI picks it up and renders an inline failure card on the activity span.
2. **Send a correction message to the same session.** The runtime reuses the prior `turnId` so the agent receives a follow-up message inside the same agent session — the entire prior context is preserved.
3. **Emit `self-correction-started`** — the same failure payload, signalling that retry is in progress. The UI badges the activity as "self-correction in progress."
4. **Wait for the agent to finish.** The runtime drives the session to completion using the same heartbeat / cancellation path as the first attempt.
5. **Re-harvest and re-validate.**
6. **On success → `self-correction-succeeded`.** The activity returns the canonical envelope with `selfCorrectionAttempted: true`. The UI banner flips to a success state.
7. **On second failure → `self-correction-failed` + throw.** Emit the lifecycle event with the second failure payload, then throw `DELIVERABLE_CONTRACT_VIOLATED` (non-retryable). The workflow terminates cleanly.

The bound is deterministic: exactly one retry, ever. There is no third attempt and no escape hatch. Repeated failures mean the agent or the spec is wrong — not a transient issue.

## What the user sees

The run-detail UI renders the failure inline on the failing activity span:

- **Reason badges** — typed codes from the closed set above, with per-reason `expected:` and `actual:` lines.
- **Expected** — the spec's contract summary: required file paths, content kinds, schema refs, multi-page slugs.
- **What the agent did** — the actual harvested shape: file list with sizes + content kinds, parsed JSON sample, response excerpt.
- **Agent's closing message** — the full assistant final text, so reviewers can compare the agent's claim against the harvested reality.
- **Outcome banner** — one of "Deliverable validation failed", "Self-correction in progress", "Self-correction succeeded", or "Self-correction failed".

When self-correction also fails, the card shows both attempts side-by-side. The progression — first attempt → correction message → second attempt — is observable in the timeline through the four lifecycle events.

## Why same session

Reusing the agent session (via `turnId`) preserves the agent's full prior reasoning context. Starting a fresh session would lose:
- The prior conversation and tool-call history.
- The state the agent built up exploring the workspace.
- The reasoning chain that led to the (incorrect) first attempt.

A correction in the same session lets the agent see "I claimed X but the harvester reports Y; here's why; please fix it" — which usually leads to a focused, targeted fix rather than starting over and potentially repeating the same mistake.

## Why exactly one attempt

Two attempts is the principled ceiling:

- **One attempt** wouldn't differentiate between a hallucination (recoverable) and a genuine bug (not recoverable).
- **Three or more attempts** would mask repeated failures and burn LLM budget on agents that are stuck in a wrong-direction loop.
- **Two** gives the agent one fair chance to read its own mistake and fix it, while keeping the failure observable.

If your workflow needs more retries, the right primitive is a higher-level retry policy on the workflow itself — not more turns inside a single activity.

## Errors are non-retryable

`DELIVERABLE_CONTRACT_VIOLATED` is registered as a non-retryable failure type on `xema/agent`. The Xema Workflow Runtime will not retry the activity. The workflow's failure handling path takes over (matrix-level fan-out, downstream `if:` gates, run-level error handler). `xema/review` invocations propagate the same failure transparently — the review's per-iteration draft step IS an `xema/agent` activity, so a contract violation surfaces with the same envelope.

---

**Previous**: [← Output Envelope](./03-output-envelope.md)
**Next**: [Examples →](./examples/index.md)
