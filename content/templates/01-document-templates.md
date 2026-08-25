# Document Templates

A **Template** is reusable, governed construction guidance. A
`MARKDOWN_DOCUMENT` deliverable spec is the separate acceptance contract that
describes the pages or files a document must produce.

## Template Bindings

A document spec may select a Template with an owner-qualified binding:

```json
{
  "ownerSpaceRef": {
    "fence": "tenant",
    "orgId": "org-123",
    "space": {
      "tier": "org",
      "orgId": "org-123"
    }
  },
  "target": {
    "resourceKind": "template",
    "resourceId": "template-architecture-decision-record",
    "selector": {
      "kind": "release-channel",
      "channel": "stable"
    }
  }
}
```

The owner is mandatory. Xema never guesses between organization, biome, or
system resources with a similar slug. A release-channel selector is resolved
to an exact revision before execution; an exact selector remains immutable as
authored.

## Creating a Markdown-Document Spec

The spec contains acceptance metadata and an optional Template binding. It does
not contain reusable markdown, Handlebars, assets, or renderer code.

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "architecture-decision-record",
    "version": "1.0.0",
    "title": "Architecture decision record",
    "kind": "MARKDOWN_DOCUMENT",
    "category": "architecture",
    "templateBinding": {
      "ownerSpaceRef": {
        "fence": "tenant",
        "orgId": "org-123",
        "space": { "tier": "org", "orgId": "org-123" }
      },
      "target": {
        "resourceKind": "template",
        "resourceId": "template-architecture-decision-record",
        "selector": { "kind": "release-channel", "channel": "stable" }
      }
    },
    "pages": [
      { "slug": "decision", "title": "Decision" }
    ]
  }'
```

Omit `templateBinding` when the workflow or session supplies construction
guidance separately. The document acceptance contract still applies.

## What the Template Owns

A Template revision may contain parameter schemas, inline files,
content-addressed assets, nested Template dependencies, and bounded render
transforms. Its Template kind is open and biome-qualified, so new renderers do
not require extending a platform enum.

Templates can depend on a DesignSystem. Publication resolves the complete
dependency graph to exact revisions and rejects cycles or unauthorized
cross-owner edges. Produced artifacts record the exact Template and
DesignSystem pins used for the render.

## What the Deliverable Spec Owns

The spec owns required files and pages, target slots, validation rules,
review dimensions, and evaluation policy. Validation checks the harvested
document against those requirements; it does not treat the Template as an
acceptance contract.

## Failure Behaviour

An unreadable binding, missing exact revision, hash mismatch, or unauthorized
dependency fails the operation. Xema does not fall back to a similarly named
Template or to retired inline spec content.

---

**Next**: [Schema Validation →](./02-schema-validation.md)
