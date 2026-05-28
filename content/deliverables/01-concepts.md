# Concepts

A **deliverable spec** is the contract that ties a workflow step to what the agent must produce. Every spec carries a `kind` (which content shape) and a `targetSlot` (where the output lands).

---

## The seven kinds

The framework supports a closed set of deliverable kinds. Adding a new one is rare — the existing kinds cover document generation, structured JSON, raw responses, code emission, and webhook-fetched payloads.

| Kind | What the agent produces | Typical use |
|---|---|---|
| `document-template` | A multi-page markdown manifest + per-page artifacts | Requirements docs, architecture docs, runbooks |
| `json-schema` | A JSON value validated by a JSON Schema (Draft 2020-12) | Structured plans, configurations, machine-readable outputs |
| `zod-schema` | A JSON value validated by a Zod schema | Same as `json-schema`, with TypeScript-friendly authoring |
| `structured-json` | A looser JSON shape with rules hints (no strict schema) | Early-phase outputs, exploratory data |
| `endpoint-fetch` | A payload the runtime fetches from a configured endpoint | Integrations that proxy upstream data into the workflow |
| `response-only` | The agent's final assistant message — no file emitted | Direct answers, summaries, decisions |
| `custom` | A list of files written into the target slot | Code emission, artifacts that don't fit other kinds |

## Where deliverables land — `targetSlot`

Every file-emitting deliverable declares its `targetSlot` — the workspace slot the agent writes into and the harvester reads from.

```yaml
targetSlot:
  kind: deliverables
```

Default. The agent writes under `/workspace/deliverables/` and the artifact ends up in the deliverables namespace. Suitable for documents, JSON payloads, and any output that downstream jobs consume but doesn't ship to a code repository.

```yaml
targetSlot:
  kind: repos
  repoSlug: my-microservice
```

The agent writes into `/workspace/repos/<slug>/` (a real working copy of the repo). The harvester emits each file as an artifact tagged to that repo. Suitable for code-emitting flows: scaffolding new services, generating config files for an existing repo, applying patches.

The kind enum is closed. Files emitted to other paths fail validation with `WRONG_TARGET_SLOT`.

## Response-only vs file-emitting

Most kinds are **file-emitting**: the harvester scans the target slot and uploads whatever the agent wrote.

`response-only` is different. There's no file scan; the agent's closing assistant message *is* the deliverable. The runtime captures the final text of the session and surfaces it on `agentResult.deliverable.content.text`. Empty responses fail validation with `EMPTY_RESPONSE`.

Pick `response-only` for:
- Direct Q&A flows where structure adds friction.
- Decisions, verdicts, summaries delivered as natural language.
- Steps that compose with downstream `json-schema` / `document` jobs but don't themselves produce a structured output.

## Multi-page document templates

Document-template specs may declare a `multiPage` block listing every required page slug + title. The harvester verifies each declared slug has a rendered page on disk; missing slugs surface as `MISSING_PAGE` reasons on the validation failure.

```yaml
multiPage:
  manifestPath: manifest.json
  pagePathTemplate: pages/<slug>.md
  pages:
    - slug: overview
      title: Overview
    - slug: architecture
      title: Architecture
    - slug: runbook
      title: Runbook
```

Single-page docs omit `multiPage` and use the `files[]` block instead.

## When to introduce a new kind

Don't, unless you must. The seven kinds cover every use case the framework has met so far. Before adding a new kind, ask:
- Can this be `custom` with a typed slot?
- Can this be `json-schema` with a richer schema?
- Can this be `response-only` with a structured prompt?

A new kind requires a new validator branch, a new content arm in the canonical envelope, a new harvester routing rule, and a new frontend rendering. It's a real cost. Prefer extending an existing kind.

---

**Next**: [Authoring →](./02-authoring.md)
