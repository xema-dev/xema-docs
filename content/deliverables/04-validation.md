# Validation

A deliverable spec is checked in two different places, and they answer two different questions. The **harvester**, inside the producing job, asks *which file in the workspace is the deliverable*. The **`xema/validate-deliverables`** action, in a job you write, asks *do the produced artifacts satisfy the spec* — and it answers with a verdict the workflow branches on rather than an exception.

---

## Two checks, two jobs

| Where | What it decides | On a mismatch |
|---|---|---|
| Harvest — inside the producing job | Which of the files the agent wrote is the structured deliverable | Records warnings and returns no structured value. The job does not throw. |
| `xema/validate-deliverables` — a job you author | Whether the produced artifacts satisfy the spec | Returns `verdict: fail`. The job itself still succeeds. |

Neither of them ends the run on its own. Validation is a fact the workflow reads; what a failing verdict *means* is a decision the workflow author writes as an `if:` gate.

## Harvest-time discovery

Discovery is schema-driven, not name-driven. The harvester walks the `canonicalPath` and any `fallbackPaths` declared by the spec's output contract, parses each candidate as JSON, and asks `deliverable-specs-api` — `POST /deliverable-specs/{ref}/validate-content` — which one matches the spec's content shape. The first match wins; when several match, the canonical path is preferred. The agent can write any reasonable filename and discovery still works.

Two kinds do not take this path, because their deliverable is not a single JSON value: `MARKDOWN_DOCUMENT` and `ENDPOINT_FETCH`. For those the endpoint answers `applicable: false` and the harvester uses its own kind-specific walk.

When nothing matches, the harvester records a warning naming every path it tried and why each candidate was rejected, and returns no structured value. It does not throw — the producing job completes, and the downstream gate is what reacts.

## `xema/validate-deliverables`

```yaml
validate:
  needs: [draft]
  uses: xema/validate-deliverables@1.0.2
  with:
    deliverableSpecRef: architecture-standard
    strictness: standard
    artifactIds:
      - ${{ needs.draft.outputs.deliverables[0].artifactId }}
  outputs:
    verdict: ${{ job.outputs.verdict }}
    issues: ${{ job.outputs.issues }}
```

| Input | Required | Meaning |
|---|---|---|
| `deliverableSpecRef` | yes | `<slug>` or `<slug>@<version>`. Resolved server-side — an org override wins over the system row. |
| `artifactIds` | yes | The artifact ids the producing job emitted. Order is preserved in the issue list. |
| `strictness` | no | `lenient`, `standard`, or `strict`. Defaults to `standard`. |

| Output | Shape | Meaning |
|---|---|---|
| `verdict` | `pass` \| `fail` \| `warn` | The single value downstream `if:` gates read |
| `issues` | `ValidationIssue[]` | Every issue found, in artifact order |
| `specVersion` | string | Version of the spec the verdict was computed against |
| `checkedAt` | ISO-8601 timestamp | When the verdict was computed |

Each issue is `{ severity, code, message, artifactId, path }`, where `severity` is `error` or `warning` and `artifactId` / `path` may be `null`.

The action resolves the spec and computes the verdict server-side, so changing a spec's rules changes the verdict without redeploying a worker. It declares `artifacts: read`, a one-minute `startToClose` timeout, and up to two attempts — with `ValidationError` and `UnauthorizedError` marked non-retryable. Those retries are about the validation *call* failing; a `fail` verdict is a successful call and is never retried.

## What it checks

Two cross-cutting artifact-count rules apply to every kind, and each kind may add rules of its own. Today exactly one built-in kind does.

| Code | Raised when |
|---|---|
| `INSUFFICIENT_ARTIFACTS` | Fewer artifacts than the spec requires. The spec's `rules.minArtifactCount` sets the floor; with none declared, the default is one artifact for every kind except `ENDPOINT_FETCH`, which defers to its own entry-count rule. |
| `EXCESS_ARTIFACTS` | More artifacts than the spec's `rules.maxArtifactCount` allows. Only applies when the spec declares a cap. |
| `ENDPOINT_FETCH_COUNT_MISMATCH` | An `ENDPOINT_FETCH` spec whose `fetchSpec` declares *n* endpoints did not produce exactly *n* artifacts. |

`code` is a string on the wire, not a closed kernel enum — a biome that contributes its own deliverable kind contributes its own codes along with it. The three above are what the built-in kinds emit.

Deeper per-kind content checks — a full Zod evaluation, schema-match reporting against the produced artifact — are not part of this action today. What the spec's content shape *does* gate is harvest-time discovery, above.

## Strictness only moves severity

`strictness` does not change which rules run or what they look at. It decides how an issue is graded:

| Strictness | Every issue is graded |
|---|---|
| `lenient` | `warning` |
| `standard` | `error` |
| `strict` | `error` |

`strict` is accepted and is evaluated identically to `standard` today.

## The verdict follows from the issues

```
any issue with severity 'error'  →  fail
otherwise, any issue at all      →  warn
no issues                        →  pass
```

So `lenient` turns what would have been a `fail` into a `warn` — the issues are identical, and only their grading moved. A workflow that wants to proceed on warnings writes `verdict != 'fail'`; one that wants a clean bill writes `verdict == 'pass'`.

## Branching on the verdict

The point of returning a verdict rather than throwing is that the workflow author decides what happens next. Both branches are ordinary jobs:

```yaml
publish-pass:
  needs: [draft, validate]
  if: ${{ needs.validate.outputs.verdict == 'pass' }}
  uses: xema/publish-kb@1.2.3
  with:
    spaceSlug: architecture
    slug: ${{ format('arch-{0}', xema.run.id) }}
    title: Architecture deliverable
    artifactId: ${{ needs.draft.outputs.deliverables[0].artifactId }}
    versionId: ${{ needs.draft.outputs.deliverables[0].versionId }}
    version: ${{ needs.draft.outputs.deliverables[0].version }}

publish-fail:
  needs: [validate]
  if: ${{ needs.validate.outputs.verdict != 'pass' }}
  uses: xema/publish-kb@1.2.3
  with:
    spaceSlug: architecture
    slug: ${{ format('arch-issues-{0}', xema.run.id) }}
    title: ${{ format('Validation {0}', needs.validate.outputs.verdict) }}
    markdown: ${{ format('# Verdict: {0}\n\n```json\n{1}\n```\n', needs.validate.outputs.verdict, toJSON(needs.validate.outputs.issues)) }}
```

The same `issues` array is what an author renders, files, or forwards. Nothing else has to be reconstructed from the run history.

## Retrying a failed deliverable

There is no retry inside the producing job. If a workflow should try again when a deliverable does not satisfy its spec, that is expressed with ordinary workflow structure: a second producing job, gated on `verdict != 'pass'`, taking the `issues` array as part of its input.

Keeping it in the workflow keeps it visible: the second attempt is a job in the graph, with its own inputs, its own artifacts, and its own verdict.

---

**Previous**: [← Output Envelope](./03-output-envelope.md)
**Next**: [Examples →](./examples/index.md)
