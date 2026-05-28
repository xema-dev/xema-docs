# Agent Step (`xema/agent`)

The **agent step** runs an AI agent against a workspace and returns its result. It is the most-used job type in Xema workflows — every phase that needs language-model work uses it.

This page documents the full input surface for `xema/agent`. For the broader DSL grammar see [DSL Reference](./01-reference.md).

---

## Minimal usage

```yaml
jobs:
  draft-spec:
    uses: xema/agent
    with:
      agentSlug: requirements
      deliverableSpecRef: feature-spec
```

`agentSlug` and `deliverableSpecRef` are the two required inputs. Every other field is optional and falls back to the agent's defaults.

---

## Inputs

### `agentSlug` *(required)*

The agent that runs the step. The Workflow Designer's Inspector shows a searchable list of agents visible to the org; in raw YAML you use the slug directly. Filtering takes role and phase from sibling fields when present.

### `deliverableSpecRef` *(required)*

The contract for what the step must produce. Resolved against the deliverable-specs catalog; an unknown ref fails compile.

### `workspaceManifestRef`

An `xema://manifest/<slug>@<version>` reference. Mounts the manifest's repos, skills, MCP services, and sub-agents for this step. Mutually exclusive with inline mounts.

```yaml
with:
  agentSlug: engineering
  workspaceManifestRef: xema://manifest/engineering-standard@1.1.0
```

### `model`

Per-step model override. Two shapes (discriminated by `kind`):

```yaml
# Pin a concrete model
with:
  model:
    kind: concrete
    modelId: anthropic/claude-opus-4-7
    providerSlug: anthropic            # optional
    temperature: 0.2                   # optional

# Route through a model strategy
with:
  model:
    kind: strategy
    modelClass: coding                 # coding | review | creative | planning | utility
    temperature: 0.2
```

- **Absent** → the agent's own `modelClass` cascade resolves the model at dispatch.
- **`concrete`** → pinned. Re-resolution is a no-op until you change the binding.
- **`strategy`** → routed. A strategy rebind (e.g. `coding` re-points at a different model) takes effect on the next dispatch without editing YAML.

### `subAgents`

Additional sub-agent bindings layered on top of the primary's intrinsic delegates (see [Sub-agents](../interactive-sessions/04-sub-agents.md) for the model). Each entry:

```yaml
with:
  agentSlug: engineering
  subAgents:
    - slug: build-verifier
    - slug: web-researcher
      alias: rfc-researcher           # optional display name
      model:                          # optional per-binding model override
        kind: concrete
        modelId: anthropic/claude-haiku-4-5-20251001
```

A binding may target an intrinsic slug **purely to refine its model** — the slug stays mounted regardless. Same-slug duplicates within the list are rejected at compile.

### `agentContext`

Free-form context object passed to the agent's prompt template. The template decides which keys it interpolates; both sides may evolve. Always allowed additional properties.

```yaml
with:
  agentSlug: review
  agentContext:
    prompt: "Focus on test coverage and SQL injection vectors."
    severity_floor: high
```

### `allowAgentToolInquiries`

When `true`, the agent may pause mid-turn to ask the user a question via the inquiry channel. When `false`, mid-turn questions auto-resolve to a default answer.

```yaml
with:
  agentSlug: requirements
  allowAgentToolInquiries: true
```

---

## Outputs

The agent step emits three named outputs, each an artifact reference:

| Output | Shape | Content |
|---|---|---|
| `response` | `ArtifactRef` | The agent's final markdown narrative (always emitted; type `markdown_doc`). |
| `structuredOutput` | `ArtifactRef \| null` | The validated JSON payload when the run used a JSON output schema; `null` otherwise (type `json_payload`). |
| `deliverables` | `ArtifactRef[]` | Files the agent harvested from `/workspace/deliverables/`. One ref per file; per-file kind comes from the spec. |

See [Output Envelope](../deliverables/03-output-envelope.md) for the full `ArtifactRef` shape and how it flows through downstream activities.

Downstream jobs read each output by name and can reach into its `ArtifactRef` fields directly:

```yaml
jobs:
  draft:
    uses: xema/agent
    with:
      agentSlug: requirements
      deliverableSpecRef: feature-spec

  review:
    needs: [draft]
    uses: xema/review
    with:
      subjects:
        # The narrative goes through the standard reviewer panel — markdown
        # renderer, anchored comments, version history — automatically.
        - artifactId: ${{ needs.draft.outputs.response.artifactId }}
          versionId: ${{ needs.draft.outputs.response.versionId }}
          version: ${{ needs.draft.outputs.response.version }}
          type: markdown_doc

  publish:
    needs: [review]
    if: ${{ needs.review.outputs.outcome == 'approved' }}
    uses: xema/publish-kb
    with:
      spaceSlug: docs
      slug: feature-spec
      title: Feature spec
      # `xema/publish-kb` accepts the ref triple directly — it fetches
      # the bytes from artifact-store.
      artifactId: ${{ needs.draft.outputs.response.artifactId }}
      versionId: ${{ needs.draft.outputs.response.versionId }}
      version: ${{ needs.draft.outputs.response.version }}
```

Each harvested deliverable is addressable positionally:

```yaml
publish-doc:
  needs: [draft]
  uses: xema/publish-kb
  with:
    artifactId: ${{ needs.draft.outputs.deliverables[0].artifactId }}
    versionId: ${{ needs.draft.outputs.deliverables[0].versionId }}
    version: ${{ needs.draft.outputs.deliverables[0].version }}
```

---

## Designer Inspector

Open a workflow YAML in the Studio canvas, select an `xema/agent` job, and the right-side Inspector renders form controls for every input above:

- **Model** — three modes (Agent default / Use strategy / Pin to model). The "Pin" mode shows a filterable list of every registry-active model with provider + display name.
- **Sub-agents** — list editor with an inline picker (filter by slug or name) and a per-row model override (same three modes).
- All other inputs render through the SpecForm framework — domain-bound fields (deliverable specs, workspace manifests, repos, knowledge-base spaces, sub-agent slugs) come up as searchable pickers, never free-text.

The YAML buffer is the source of truth — Inspector edits flow through the same `setJobWithField` mutations as direct text edits.

---

## See also

- [DSL Reference](./01-reference.md) — full grammar
- [Sub-agents](../interactive-sessions/04-sub-agents.md) — delegate model in depth
- [Best Practices](./02-best-practices.md) — designing robust agent jobs

---

**Previous**: [← Review Step](./05-review.md)
**Next**: [Dispatch Workflow →](./07-dispatch-workflow.md)
