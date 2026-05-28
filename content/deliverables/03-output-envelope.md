# Output envelope

Every workflow activity returns a flat envelope of named outputs. Each declared output is an **artifact reference** — a stable pointer to bytes in artifact-store — never inline content embedded in the workflow event stream.

---

## The canonical shape

An activity declares its outputs by name and type. At runtime each declared output is returned as an `ArtifactRef`:

```ts
interface ArtifactRef {
  artifactId: string;
  versionId: string;
  version: number;     // monotonic per-artifact integer (1, 2, 3, …)
  hash: string;        // content hash
  type: string;        // OutputKind: markdown_doc, json_payload, external_blob, …
  title?: string;      // optional display label
}
```

A declared output is always either:

- a single `ArtifactRef` (e.g. `response: ArtifactRef`),
- a `readonly ArtifactRef[]` when the output is variadic (e.g. `deliverables: ArtifactRef[]`),
- `null` when the activity declares the output as optional and the run produced nothing for it.

The envelope's other fields (`outcome`, `durationMs`, status counters) are orchestration metadata. They never carry reviewable bytes.

## Per-activity outputs

The standard activities expose the following named outputs.

### `xema/agent`

| Output | Shape | Kind |
|---|---|---|
| `response` | `ArtifactRef` | `markdown_doc` — the agent's final narrative |
| `structuredOutput` | `ArtifactRef \| null` | `json_payload` — only when the run used a JSON output schema |
| `deliverables` | `ArtifactRef[]` | mixed kinds — files the agent harvested from `/workspace/deliverables/` |

### `xema/http`

| Output | Shape | Kind |
|---|---|---|
| `response` | `ArtifactRef` | `json_payload` for `application/json`, `markdown_doc` for `text/*`, `external_blob` otherwise |
| `status`, `headers`, `contentType` | plain fields | response metadata, not reviewable bytes |

### `xema/webhook`

| Output | Shape | Kind |
|---|---|---|
| `response` | `ArtifactRef \| null` | `markdown_doc` — null when the upstream returned no body |

### `xema/endpoint-fetch`

| Output | Shape | Kind |
|---|---|---|
| `results` | `ArtifactRef[]` | one per fetched endpoint |
| `resultsManifest` | `ArtifactRef` | `json_payload` — per-endpoint status / size / error table |

### `xema/scm-post-review`

| Output | Shape | Kind |
|---|---|---|
| `postedComments` | `ArtifactRef` | `json_payload` — the comments the activity posted |

### `xema/emit-artifact`

| Output | Shape | Notes |
|---|---|---|
| `artifactId`, `versionId`, `version`, `hash` | plain fields | the ref the workflow author emitted, surfaced as separate fields for ergonomic access |

---

## Reading outputs from a workflow

### Same-job projection

A job's `outputs:` block selects which fields it re-exports to downstream consumers. Each entry is an arbitrary expression — the simplest form just forwards an activity output as-is.

```yaml
draft:
  uses: xema/agent
  with:
    agentSlug: requirements
    deliverableSpecRef: feature-spec
  outputs:
    response: ${{ job.outputs.response }}        # the markdown narrative ArtifactRef
    structuredOutput: ${{ job.outputs.structuredOutput }}
    deliverables: ${{ job.outputs.deliverables }}
```

### Cross-job access

Downstream jobs read outputs via `needs.<job>.outputs.<name>`. Because each output is an `ArtifactRef`, you can reach into its fields directly.

```yaml
publish:
  needs: [draft]
  uses: xema/publish-kb
  with:
    spaceSlug: docs
    slug: feature-spec
    title: Feature spec
    artifactId: ${{ needs.draft.outputs.response.artifactId }}
    versionId: ${{ needs.draft.outputs.response.versionId }}
    version: ${{ needs.draft.outputs.response.version }}
```

`xema/publish-kb` accepts an `(artifactId, versionId, version)` triple as its publish source — it fetches the bytes from artifact-store. Other activities that need the ref pass the whole shape.

### Review subjects

The `xema/review` and `xema/comment-review` activities accept `ArtifactRef`-shaped subjects directly:

```yaml
gate:
  needs: [draft]
  uses: xema/decision-gate
  with:
    subjectArtifacts:
      - artifactId: ${{ needs.draft.outputs.response.artifactId }}
        versionId: ${{ needs.draft.outputs.response.versionId }}
        version: ${{ needs.draft.outputs.response.version }}
```

The reviewer panel renders the artifact with its content-type-appropriate renderer, exposes version history, and accepts anchored comments — uniformly across every kind of reviewable output.

### Variadic outputs

Outputs declared as arrays (e.g. `deliverables`) are indexed positionally:

```yaml
publish-doc:
  needs: [draft]
  uses: xema/publish-kb
  with:
    artifactId: ${{ needs.draft.outputs.deliverables[0].artifactId }}
    versionId: ${{ needs.draft.outputs.deliverables[0].versionId }}
    version: ${{ needs.draft.outputs.deliverables[0].version }}
```

### Matrix-keyed access

Matrix and dynamic jobs surface their outputs under `byKey[<key>]` (when `keyBy:` is declared) or by integer index in `byMatrix[N]`. The same `ArtifactRef` shape applies inside each iteration:

```yaml
publish-keyed:
  needs: [requirements]
  uses: xema/publish-kb
  with:
    artifactId: ${{ needs.requirements.outputs.byKey[matrix.changeUnit.id].deliverables[0].artifactId }}
    versionId: ${{ needs.requirements.outputs.byKey[matrix.changeUnit.id].deliverables[0].versionId }}
    version: ${{ needs.requirements.outputs.byKey[matrix.changeUnit.id].deliverables[0].version }}
```

---

## Why every output is an artifact reference

This is the unified-outputs contract: workflow authors emit content, the platform handles persistence. Every reviewable byte that flows through a workflow lives in artifact-store, gets a stable id and version, and is addressable through the same `ArtifactRef` shape.

The benefits:

- **Review tooling is uniform.** Anchored comments, version history, and content-type-aware rendering work the same way for every output, because every output is an artifact-store row.
- **Replays are deterministic.** The compiled run pins each consumer to a specific `versionId`, so a re-emit upstream never silently shifts what a downstream consumer saw.
- **No event-stream payload limits.** Inline strings, however small in the source workflow, ballooned in matrix expansion. References are constant-size pointers.
- **Authors write content, not artifact-store calls.** The activity body returns a string or a JSON object on a declared output; the platform promotes it to an artifact transparently.

---

**Previous**: [← Authoring](./02-authoring.md)
**Next**: [Validation & Self-Correction →](./04-validation-and-self-correction.md)
