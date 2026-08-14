# Document Templates & Deliverable Specs

> API Docs: https://deliverable-specs-api.xema.dev/api/docs

Deliverable Specs define **what agents produce**. They are templates, schemas, and validation rules attached to workflow jobs or interactive sessions, guiding agents to deliver structured, validated output.

## What Are Deliverable Specs?

A **Deliverable Spec** (`deliverable-spec`) is a versioned, org-managed artifact definition. When an agent runs with a spec attached, it:

1. Receives the spec as context (mounted at `/workspace/deliverable-specs/<slug>/`)
2. Understands the structure, format, and validation rules expected
3. Produces output that conforms to the spec
4. The platform validates the output and provides pass/warn/fail verdicts

### Why Use Them?

- **Consistency** — All teams produce documents and data in the same format
- **Validation** — Automated checks catch incomplete or malformed output
- **Customization** — Orgs can override system specs with their own standards
- **Composability** — Overlays add stack-specific or concern-specific requirements without duplicating specs

---

## Spec Kinds

| Kind | Use Case |
|------|----------|
| `DOCUMENT_TEMPLATE` | Markdown/Word documents with Handlebars placeholders |
| `ZOD_SCHEMA` | TypeScript Zod schema for runtime validation |
| `JSON_SCHEMA` | JSON Schema Draft 2020-12 for structured data validation |
| `STRUCTURED_JSON` | Flexible JSON with rule-bag hints |
| `ENDPOINT_FETCH` | Pull data from an external endpoint |
| `CUSTOM` | Bespoke validation rules |

---

## `DOCUMENT_TEMPLATE`

The most common kind. Define a Markdown (or Word) document structure with **Handlebars** placeholders. The agent fills in the content.

### Basic Example

```markdown
---
spec: document-template
slug: requirements-standard
version: 1.0.0
kind: DOCUMENT_TEMPLATE
---

# {{projectName}} — Requirements Document

**Version**: {{version}}  
**Date**: {{date}}  
**Author**: {{author}}

## Executive Summary

{{executiveSummary}}

## Problem Statement

{{problemStatement}}

## Goals & Non-Goals

### Goals
{{#each goals}}
- {{this}}
{{/each}}

### Non-Goals
{{#each nonGoals}}
- {{this}}
{{/each}}

## Requirements

{{#each requirements}}
### {{id}}: {{title}}

**Priority**: {{priority}}  
**Status**: {{status}}

{{description}}

{{#if acceptanceCriteria}}
**Acceptance Criteria:**
{{#each acceptanceCriteria}}
- {{this}}
{{/each}}
{{/if}}

{{/each}}
```

### Handlebars Syntax

| Syntax | Purpose |
|--------|---------|
| `{{variable}}` | Insert a value |
| `{{#each items}}...{{/each}}` | Iterate over an array |
| `{{#if condition}}...{{/if}}` | Conditional block |
| `{{#with obj}}...{{/with}}` | Change context to an object |
| `{{else}}` | Else branch in `#if` or `#each` |

### Multi-Page Documents

Specs can define multiple pages (for wiki-style outputs or reports with multiple sections):

```json
{
  "multiPage": true,
  "pages": [
    {
      "slug": "overview",
      "title": "Project Overview",
      "content": "# {{projectName}}\n\n{{overview}}"
    },
    {
      "slug": "requirements",
      "title": "Requirements",
      "parentSlug": "overview",
      "content": "## Requirements\n\n{{#each requirements}}..."
    },
    {
      "slug": "architecture",
      "title": "Architecture",
      "content": "## Architecture\n\n{{architectureDiagram}}"
    }
  ]
}
```

Each page is produced as a separate document. `parentSlug` creates a hierarchy.

### Asset Attachments

Specs can include template assets like Word document templates (`.docx`) or images:

```json
{
  "assets": [
    {
      "id": "word-template",
      "name": "corporate-requirements.docx",
      "contentType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "data": "<base64-encoded-content>"
    }
  ]
}
```

Download an asset:
```bash
GET /deliverable-specs/{ref}/assets/{assetId}
```

---

## `ZOD_SCHEMA`

Define a TypeScript Zod schema. The agent's output is validated against this schema at runtime.

### Example

```typescript
// Schema source (TypeScript)
import { z } from 'zod';

export const RequirementsSchema = z.object({
  projectName: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  requirements: z.array(z.object({
    id: z.string(),
    title: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    description: z.string().min(10),
    acceptanceCriteria: z.array(z.string()).min(1),
  })).min(1, 'At least one requirement is needed'),
  nonFunctionalRequirements: z.array(z.object({
    category: z.enum(['performance', 'security', 'scalability', 'accessibility']),
    description: z.string(),
  })).optional(),
});

export default RequirementsSchema;
```

**Spec definition:**

```json
{
  "slug": "requirements-schema",
  "kind": "ZOD_SCHEMA",
  "zodSchemaSource": "import { z } from 'zod';\nexport const schema = z.object({...});"
}
```

### Validation Behavior

- Schema is compiled and executed in a worker pool
- Invalid output → `fail` verdict with issue list
- Missing optional fields → `warn` verdict
- All fields valid → `pass` verdict

---

## `JSON_SCHEMA`

Standard JSON Schema Draft 2020-12. Good for data exchange and when TypeScript tooling is not needed.

### Example

```json
{
  "slug": "deployment-config",
  "kind": "JSON_SCHEMA",
  "jsonSchema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["serviceName", "environment", "replicas"],
    "properties": {
      "serviceName": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9-]*$"
      },
      "environment": {
        "type": "string",
        "enum": ["development", "staging", "production"]
      },
      "replicas": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10
      },
      "resources": {
        "type": "object",
        "properties": {
          "cpu": { "type": "string" },
          "memory": { "type": "string" }
        }
      }
    }
  }
}
```

---

## `STRUCTURED_JSON`

Flexible JSON validation with rule-bag hints. Useful when you need guidance rather than strict validation.

```json
{
  "slug": "meeting-notes",
  "kind": "STRUCTURED_JSON",
  "rules": {
    "required_keys": ["date", "attendees", "action_items"],
    "hints": [
      "action_items must include owner and due_date",
      "attendees should be full names or email addresses"
    ]
  }
}
```

---

## `ENDPOINT_FETCH`

Fetch validation rules or schema from an external endpoint. The platform calls your endpoint and uses the returned spec for validation:

```json
{
  "slug": "external-compliance-check",
  "kind": "ENDPOINT_FETCH",
  "fetchSpec": {
    "url": "https://compliance.acme.com/schemas/current",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer {{env.COMPLIANCE_API_KEY}}"
    }
  }
}
```

---

## Spec Versioning & References

Specs are referenced by `slug[@version]`:

```yaml
requirements-standard         # Latest version
requirements-standard@1.0.0  # Pinned version
requirements-standard@latest  # Explicit latest
```

### Resolution Order

When resolving a spec reference:
1. **Org override** — Check if the org has overridden this slug
2. **System spec** — Fall back to the platform's built-in spec
3. **404** — Not found

This means organizations can always customize platform defaults without changing workflows.

---

## Using Specs in Workflows

### Attaching to an Agent Job

```yaml
jobs:
  create-requirements:
    uses: xema/agent
    with:
      deliverableSpecRef: requirements-standard@1.0.0
      task: Create comprehensive requirements document for ${{ inputs.project_name }}
      targetSlot: deliverables/requirements.md
    outputs:
      doc_id: ${{ result.artifact_id }}
      validation_passed: ${{ result.validation_passed }}
```

The spec is automatically mounted at `/workspace/deliverable-specs/requirements-standard/` in the agent's workspace.

### Attaching to an Interactive Session

```bash
POST /sessions/{id}/messages
{
  "content": "Please create a requirements document using the mounted template",
  "deliverableSpecRef": "requirements-standard@1.0.0"
}
```

Or set at session creation if the spec is known upfront.

---

## Spec Overlays

**Overlays** extend an existing spec without replacing it. They add additional requirements based on **tags** — the platform automatically applies relevant overlays based on your project's technology stack and concerns.

### Built-in Overlays

| Tag | Applied When |
|-----|-------------|
| `stack:spring-jpa` | Spring Boot + JPA projects |
| `stack:nextjs-vercel` | Next.js + Vercel projects |
| `concern:security` | Security-sensitive workflows |
| `concern:performance` | Performance-critical systems |
| `concern:accessibility` | User-facing UI work |

### How Overlays Work

An overlay appends content to a base spec:

**Base spec** (`requirements-standard@1.0.0`):
```markdown
# Requirements Document
{{summary}}
...
```

**Overlay** (`stack:spring-jpa`):
```markdown
## Spring Boot / JPA Specific Requirements
- Describe JPA entity changes
- List new API endpoints and their contracts
- Document database migration requirements
```

**Combined output** (base + overlay appended):
```markdown
# Requirements Document
...

## Spring Boot / JPA Specific Requirements
...
```

### Tag-Based Selection

The platform evaluates the project's stack tags and automatically applies matching overlays:

```bash
# Create an overlay binding
POST /deliverable-specs/{specId}/overlay-bindings
{
  "tagCategory": "stack",
  "tagValue": "spring-jpa",
  "content": "## Database Schema Requirements\n\n..."
}
```

### Force-Binding Overlays

You can explicitly force an overlay regardless of project tags:

```yaml
jobs:
  secure-requirements:
    uses: xema/agent
    with:
      deliverableSpecRef: requirements-standard@1.0.0
      overlays:
        - concern:security     # Force-apply security overlay
        - concern:performance  # Force-apply performance overlay
```

---

## Validation

Validate a document against a spec without running a workflow:

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "specRef": "requirements-standard@1.0.0",
    "content": "# My Document\n\n..."
  }'
```

**Response:**

```json
{
  "verdict": "pass",
  "issues": [],
  "duration_ms": 120
}
```

Or with issues:

```json
{
  "verdict": "warn",
  "issues": [
    {
      "field": "requirements",
      "severity": "warning",
      "message": "No non-functional requirements provided"
    }
  ]
}
```

### Validation Verdicts

| Verdict | Meaning |
|---------|---------|
| `pass` | All validations passed |
| `warn` | Passed with non-blocking warnings |
| `fail` | One or more errors — output is not acceptable |

---

## Managing Specs via API

### Create a Spec

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "my-requirements-template",
    "kind": "DOCUMENT_TEMPLATE",
    "title": "My Requirements Template",
    "content": "# {{projectName}}\n\n{{description}}"
  }'
```

### List Specs

```bash
curl "https://deliverable-specs-api.xema.dev/deliverable-specs" \
  -H "Authorization: Bearer $TOKEN"

# With filters
curl "https://deliverable-specs-api.xema.dev/deliverable-specs?kind=DOCUMENT_TEMPLATE&phase=requirements" \
  -H "Authorization: Bearer $TOKEN"
```

### Get a Spec (by slug or versioned ref)

```bash
curl "https://deliverable-specs-api.xema.dev/deliverable-specs/requirements-standard@1.0.0" \
  -H "Authorization: Bearer $TOKEN"
```

### Browse Spec Facets

```bash
curl "https://deliverable-specs-api.xema.dev/deliverable-specs/facets" \
  -H "Authorization: Bearer $TOKEN"
```

Returns distinct categories, complexities, phases, work types, and tags — useful for building filter UIs.

---

## Creating Custom Templates

### Step 1: Design the Template

Start with a Markdown template:

```markdown
# {{projectName}} — Architecture Decision Record

**Date**: {{date}}  
**Status**: {{status}}  
**Deciders**: {{#each deciders}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}

## Context

{{context}}

## Decision

{{decision}}

## Consequences

### Positive
{{#each positiveConsequences}}
- {{this}}
{{/each}}

### Negative
{{#each negativeConsequences}}
- {{this}}
{{/each}}
```

### Step 2: Create the Spec

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "slug": "architecture-decision-record",
    "kind": "DOCUMENT_TEMPLATE",
    "title": "Architecture Decision Record (ADR)",
    "description": "Lightweight ADR template for architectural decisions",
    "tags": ["architecture", "documentation"],
    "workType": "documentation",
    "complexity": "low",
    "estimatedTokens": 2000,
    "content": "# {{projectName}} — Architecture Decision Record\n..."
  }'
```

### Step 3: Publish a Version

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs/{id}/publish \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"version": "1.0.0"}'
```

### Step 4: Use in a Workflow

```yaml
jobs:
  create-adr:
    uses: xema/agent
    with:
      deliverableSpecRef: architecture-decision-record@1.0.0
      task: Create an ADR for our decision to use microservices
```

---

**Next**: [Schema Validation Deep Dive](./02-schema-validation.md)  
**See Also**: [Overlays](./03-overlays.md) | [API Reference](./04-api-reference.md)
