# Templates & Deliverable Specs

> API Docs: https://deliverable-specs-api.xema.dev/api/docs

**Templates** define how reusable output is constructed. **Deliverable specs**
define what output is expected and what counts as valid. Keeping those concerns
separate lets a team reuse one acceptance contract with different layouts or
reuse one Template for deliverables with different validation rules.

## Quick Links

| Page | What it covers |
|---|---|
| [Document Templates](./01-document-templates.md) | Template bindings and markdown-document acceptance contracts |
| [Schema Validation](./02-schema-validation.md) | Zod, JSON Schema, and structured JSON kinds |
| [Overlays](./03-overlays.md) | Stack- and concern-specific additions to a deliverable spec |
| [API Reference](./04-api-reference.md) | Public deliverable-spec endpoints and Template-binding fields |

## The Boundary

A Template is governed reusable content: files, assets, parameters, includes,
and render transforms. A deliverable spec contains output media and shape,
required files or pages, validators, and evaluation rules. It does not contain
a document skeleton, visual assets, or renderer source.

For a guided document, a `MARKDOWN_DOCUMENT` deliverable spec can hold an
owner-qualified `templateBinding`. The binding identifies the Template owner
and either an exact revision or a release channel. Xema resolves a channel to
an exact revision before execution; rendering never follows a moving channel.

## Spec Kinds

| Kind | Best for |
|---|---|
| `MARKDOWN_DOCUMENT` | Reports, ADRs, requirements, and other human-readable documents |
| `ZOD_SCHEMA` | Structured output described by a Zod schema |
| `JSON_SCHEMA` | Structured output described by JSON Schema |
| `STRUCTURED_JSON` | JSON output with a flexible schema contract |
| `RESPONSE_ONLY` | A final response with no workspace file |
| `ENDPOINT_FETCH` | Output obtained from an explicitly configured endpoint |
| `CUSTOM` | A biome-provided acceptance contract |

## Getting Started

1. Read [Document Templates](./01-document-templates.md) to understand Template
   bindings and markdown-document output.
2. Read [Schema Validation](./02-schema-validation.md) for machine-readable
   deliverables.
3. Add [Overlays](./03-overlays.md) when project context must extend the base
   acceptance contract.

## FAQ

**Can a deliverable spec contain Handlebars or markdown skeleton content?**

No. Reusable construction guidance belongs to a Template. The spec may select
that Template with `templateBinding`.

**Does a Template binding follow a release channel during a run?**

No. The channel is resolved once and the run keeps the resulting exact pin.
