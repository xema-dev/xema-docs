# Deliverable Specs API Reference

The public **Deliverable Specs API** manages acceptance contracts. For
`MARKDOWN_DOCUMENT`, the contract can select separately governed construction
guidance through `templateBinding`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/deliverable-specs` | List visible specs, optionally filtered by kind or phase |
| `GET` | `/deliverable-specs/{ref}` | Resolve a spec reference |
| `POST` | `/deliverable-specs` | Create an organization-owned spec |
| `POST` | `/deliverable-specs/preview-content` | Validate an authored body without persistence |
| `POST` | `/deliverable-specs/{ref}/validate-content` | Test content against the selected spec's kind handler |
| `POST` | `/deliverable-specs/validate` | Validate produced artifacts against a spec |

See the [interactive API reference](https://deliverable-specs-api.xema.dev/api/docs)
for the complete request and response schemas.

## Create Fields

| Field | Required | Meaning |
|---|---:|---|
| `slug` | Yes | Kebab-case identity, optionally namespaced with one `/` |
| `version` | Yes | Strict semantic version |
| `title` | Yes | Human-readable title |
| `kind` | Yes | One supported deliverable acceptance kind |
| `category` | Yes | Kebab-case catalog category |
| `templateBinding` | For guided `MARKDOWN_DOCUMENT` | Owner-qualified Template target; rejected as inline content |
| `content` | Kind-dependent | JSON/custom/response acceptance body; rejected for `MARKDOWN_DOCUMENT` |
| `pages` | No | Required markdown-document page topology |
| `rules` | No | Validation and inference-enforcement settings |

## Template-Binding Shape

`templateBinding` contains `ownerSpaceRef` and `target`. The target must have
`resourceKind: "template"` and a selector of either:

- `exact`, with `revisionId` and `contentHash`; or
- `release-channel`, with the authored channel name.

The release plane resolves channel intent to an immutable exact closure before
runtime. Clients should persist and display the owner-qualified target rather
than reducing it to a slug.

## Validation

`MARKDOWN_DOCUMENT` validation checks document WHAT: required output, declared
page topology, and other acceptance rules. Template resolution and rendering
validate HOW at the Template boundary. A spec never becomes a second renderer
or content authority.

---

**Previous**: [← Overlays](./03-overlays.md)
