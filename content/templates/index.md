# Templates & Deliverable Specs

> API Docs: https://deliverable-specs-api.xema.dev/api/docs

Deliverable Specs give agents structured guidance: they define **what to produce**, **how it should look**, and **what counts as valid output**.

## What's in This Section

| Page | Description |
|------|-------------|
| [Document Templates](./01-document-templates.md) | Markdown/Word templates with Handlebars, multi-page docs, assets |
| [Schema Validation](./02-schema-validation.md) | Zod, JSON Schema, and structured JSON kinds |
| [Overlays](./03-overlays.md) | Extend specs with stack and concern-specific requirements |
| [API Reference](./04-api-reference.md) | REST endpoints for managing specs, overlays, validation |

---

## Why Deliverable Specs Exist

Without a spec, an agent produces **free-form output** — which may be inconsistent across runs or teams. With a spec:

- The agent understands exactly what sections a document should have
- The platform validates the output automatically
- Org-specific overrides can tailor the spec to your standards
- Overlays automatically extend specs for NestJS, security, accessibility, etc.

---

## How It All Fits Together

```
Workflow Job / Interactive Session
        │
        ├── deliverableSpecRef: requirements-standard@1.0.0
        │
        ▼
┌─────────────────────────────────┐
│  Spec Resolution                 │
│  1. Org override?                │
│  2. System spec? (isSystem=true) │
│  3. 404                          │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│  Overlay Composition            │
│  Apply active overlays based on │
│  project stack + concern tags    │
└─────────────────────────────────┘
        │
        ▼
  Mounted at /workspace/deliverable-specs/<slug>/
        │
        ▼
┌─────────────────────────────────┐
│  Agent Produces Output           │
│  (document, JSON, PR, etc.)      │
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│  Validation                      │
│  Kind-specific handler           │
│  Verdict: pass / warn / fail     │
└─────────────────────────────────┘
```

---

## Quick Start

### 1. Browse Available Specs

```bash
curl "https://deliverable-specs-api.xema.dev/deliverable-specs" \
  -H "Authorization: Bearer $TOKEN"
```

### 2. Use a Spec in a Workflow

```yaml
jobs:
  write-requirements:
    uses: xema/agent
    with:
      deliverableSpecRef: requirements-standard@1.0.0
      task: Create requirements document for ${{ inputs.project_name }}
```

### 3. Validate a Document

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs/validate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "specRef": "requirements-standard@1.0.0",
    "content": "..."
  }'
```

### 4. Create Your Own Spec

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "slug": "my-template",
    "kind": "DOCUMENT_TEMPLATE",
    "content": "# {{title}}\n\n{{body}}"
  }'
```

---

## Spec Kinds at a Glance

| Kind | Description | Best For |
|------|-------------|----------|
| `DOCUMENT_TEMPLATE` | Handlebars markdown template | Reports, ADRs, PRDs, meeting notes |
| `ZOD_SCHEMA` | TypeScript Zod schema | Typed, validated structured data |
| `JSON_SCHEMA` | JSON Schema Draft 2020-12 | Config files, API contracts |
| `STRUCTURED_JSON` | Flexible JSON with hints | Semi-structured data |
| `RESPONSE_ONLY` | Agent response IS the deliverable (no file) | Summaries, classifications, single-shot Q&A |
| `ENDPOINT_FETCH` | Pull spec from external URL | External compliance systems |
| `CUSTOM` | Bespoke validation logic | Specialized validation |

### `RESPONSE_ONLY` — answer specs

`RESPONSE_ONLY` specs do not expect a file in `/workspace/deliverables/`.
The agent's final assistant response **is** the deliverable.

The response lands on the canonical envelope's response arm:
`agentResult.deliverable.content.text` (free-form) or, when the spec
declares a `content` JSON Schema, the platform pushes the schema to the
Xema Agent Runtime so the answer is structurally validated at inference
time and the validated payload surfaces on `agentResult.deliverable.content.value`.

Use it when the run is a single question or classification: "Summarize
this PR", "Is this commit safe to deploy?", "Pick a category from the
following list". File-based specs remain the right choice when the
deliverable is a document, code tree, or directory of artefacts.

### `enforceViaInference` — opt-in for schema specs

For `JSON_SCHEMA`, `ZOD_SCHEMA`, `STRUCTURED_JSON`, and `CUSTOM` specs
whose deliverable is a single JSON document, set
`rules.enforceViaInference: true` to additionally constrain the agent's
output at the inference layer. The platform forwards the schema to the
runtime, which validates the answer before completing the turn — a
deterministic backup to the file-write path.

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "slug": "my-contract",
    "kind": "JSON_SCHEMA",
    "content": "{ \"type\": \"object\", \"required\": [\"summary\"] }",
    "rules": { "enforceViaInference": true }
  }'
```

---

**Start Here**: [Document Templates](./01-document-templates.md) for the most common use case.
