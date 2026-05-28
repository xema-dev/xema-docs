# Deliverables — Examples

Hands-on YAML for each major kind plus the matrix mixed-kinds dispatch.

## Quick Links

| Example | What it shows |
|---|---|
| [01 Document template](./01-document-template.md) | Multi-page document with `multiPage.pages` and downstream consumers |
| [02 JSON schema](./02-json-schema.md) | JSON-schema spec with downstream `value.<field>` access |
| [03 Code into a repo](./03-code-into-repo.md) | `targetSlot: { kind: 'repos' }` for code-emitting flows |
| [04 Response-only](./04-response-only.md) | Direct answer with no file emitted |
| [05 Matrix mixed kinds](./05-matrix-mixed-kinds.md) | Variable-count fan-out: 5 microservices + 1 frontend |

## Reading order

If you're already comfortable with the framework, read whichever example matches your use case. If you're new, the first example (document template) covers the highest-leverage shape. The matrix mixed-kinds example covers the most-asked question: "how do I produce a different number of deliverables based on what the user wants?"
