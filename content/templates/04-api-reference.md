# Templates & Deliverable Specs: API Reference

> API Docs: https://deliverable-specs-api.xema.dev/api/docs

Complete REST API for deliverable spec management, validation, and overlays.

**Base URL**: `https://deliverable-specs-api.xema.dev/deliverable-specs`

**Authentication**: Bearer token required on all endpoints.

---

## Deliverable Specs

### Create Spec

```
POST /deliverable-specs
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | string | Yes | Unique identifier (URL-safe) |
| `kind` | string | Yes | `DOCUMENT_TEMPLATE` \| `ZOD_SCHEMA` \| `JSON_SCHEMA` \| `STRUCTURED_JSON` \| `ENDPOINT_FETCH` \| `CUSTOM` |
| `title` | string | Yes | Human-readable name |
| `description` | string | No | Description of the spec |
| `content` | string | No | Template content (for `DOCUMENT_TEMPLATE`) |
| `zodSchemaSource` | string | No | TypeScript Zod source (for `ZOD_SCHEMA`) |
| `jsonSchema` | object | No | JSON Schema object (for `JSON_SCHEMA`) |
| `rules` | object | No | Rules bag (for `STRUCTURED_JSON`, `CUSTOM`) |
| `fetchSpec` | object | No | Fetch config (for `ENDPOINT_FETCH`) |
| `tags` | string[] | No | Searchable tags |
| `phase` | string | No | Development phase (e.g., `requirements`, `design`) |
| `workType` | string | No | Work type classification |
| `complexity` | string | No | `low` \| `medium` \| `high` |
| `estimatedTokens` | number | No | Approximate token budget hint |
| `multiPage` | boolean | No | Enable multi-page mode |
| `pages` | object[] | No | Page definitions for multi-page specs |

**Example**:

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "architecture-decision-record",
    "kind": "DOCUMENT_TEMPLATE",
    "title": "Architecture Decision Record",
    "description": "Lightweight ADR for architectural decisions",
    "tags": ["architecture", "documentation"],
    "phase": "design",
    "workType": "documentation",
    "complexity": "low",
    "content": "# {{title}}\n\n**Status**: {{status}}\n\n## Context\n\n{{context}}\n\n## Decision\n\n{{decision}}"
  }'
```

**Response** (`201`):

```json
{
  "id": "spec_abc123",
  "slug": "architecture-decision-record",
  "version": null,
  "kind": "DOCUMENT_TEMPLATE",
  "title": "Architecture Decision Record",
  "orgId": "org-123",
  "isSystem": false,
  "multiPage": false,
  "pages": [],
  "createdAt": "2026-04-27T10:00:00Z",
  "updatedAt": "2026-04-27T10:00:00Z"
}
```

---

### List Specs

```
GET /deliverable-specs
```

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `kind` | string | Filter by kind |
| `phase` | string | Filter by development phase |
| `workType` | string | Filter by work type |
| `tags` | string | Comma-separated tag filter |
| `includeSystem` | boolean | Include platform built-in specs (default `true`) |
| `limit` | number | Max results |
| `cursor` | string | Pagination cursor |

**Example**:

```bash
# List all document templates
curl "https://deliverable-specs-api.xema.dev/deliverable-specs?kind=DOCUMENT_TEMPLATE" \
  -H "Authorization: Bearer $TOKEN"

# Filter by phase
curl "https://deliverable-specs-api.xema.dev/deliverable-specs?phase=requirements" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Get Spec

```
GET /deliverable-specs/{ref}
```

`ref` is either `slug` or `slug@version`. Returns the org override if one exists, otherwise returns the system spec.

**Examples**:

```bash
# Latest version
curl "https://deliverable-specs-api.xema.dev/deliverable-specs/requirements-standard" \
  -H "Authorization: Bearer $TOKEN"

# Pinned version
curl "https://deliverable-specs-api.xema.dev/deliverable-specs/requirements-standard@1.0.0" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Update Spec

```
PATCH /deliverable-specs/{id}
```

**Request Body**: Any subset of create fields.

---

### Delete Spec

```
DELETE /deliverable-specs/{id}
```

Only org-owned specs can be deleted. System specs cannot be deleted.

---

### Publish Spec Version

```
POST /deliverable-specs/{id}/publish
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | string | Yes | Semantic version (e.g., `1.0.0`) |

---

### Browse Facets

```
GET /deliverable-specs/facets
```

Returns distinct filter values for building search UIs.

**Response** (`200`):

```json
{
  "kinds": ["DOCUMENT_TEMPLATE", "ZOD_SCHEMA", "JSON_SCHEMA"],
  "phases": ["requirements", "design", "implementation", "review"],
  "workTypes": ["documentation", "architecture", "feature", "bugfix"],
  "complexities": ["low", "medium", "high"],
  "tags": ["security", "architecture", "spring-jpa", "performance", ...]
}
```

---

## Validation

### Validate a Document

```
POST /deliverable-specs/validate
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `specRef` | string | Yes | Spec reference (`slug` or `slug@version`) |
| `content` | string | Yes | Document/JSON content to validate |

**Example**:

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs/validate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "specRef": "requirements-standard@1.0.0",
    "content": "# Acme Platform — Requirements\n\n## Summary\n\nWe need to build..."
  }'
```

**Response** (`200`):

```json
{
  "verdict": "pass",
  "issues": [],
  "duration_ms": 85
}
```

With issues:

```json
{
  "verdict": "warn",
  "issues": [
    {
      "field": "requirements",
      "severity": "warning",
      "message": "No non-functional requirements section found"
    }
  ],
  "duration_ms": 92
}
```

### Validation Verdicts

| Verdict | Meaning |
|---------|---------|
| `pass` | All checks passed |
| `warn` | Passed with non-blocking warnings |
| `fail` | One or more blocking errors |

---

## Assets

### Get Asset

```
GET /deliverable-specs/{ref}/assets/{assetId}
```

Downloads the asset (e.g., Word template file).

**Response**: Binary content with appropriate `Content-Type` header.

---

## Overlay Bindings

### Create Overlay Binding

```
POST /deliverable-specs/{id}/overlay-bindings
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tagCategory` | string | Yes | `stack` \| `concern` |
| `tagValue` | string | Yes | Tag value (e.g., `spring-jpa`) |
| `content` | string | Yes | Markdown content to append |
| `scope` | string | No | `org` \| `org_override` (default `org`) |

**Example**:

```bash
curl -X POST "https://deliverable-specs-api.xema.dev/deliverable-specs/spec_abc123/overlay-bindings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tagCategory": "concern",
    "tagValue": "security",
    "content": "## Security Requirements\n\n### Threat Model\n..."
  }'
```

---

### List Overlay Bindings

```
GET /deliverable-specs/{id}/overlay-bindings
```

**Response** (`200`):

```json
{
  "data": [
    {
      "id": "binding_xyz",
      "specId": "spec_abc123",
      "tagCategory": "stack",
      "tagValue": "spring-jpa",
      "scope": "org",
      "content": "## Spring Boot / JPA Requirements...",
      "createdAt": "2026-04-27T10:00:00Z"
    }
  ]
}
```

---

### Update Overlay Binding

```
PATCH /deliverable-specs/{id}/overlay-bindings/{bindingId}
```

**Request Body**: `content` field.

---

### Delete Overlay Binding

```
DELETE /deliverable-specs/{id}/overlay-bindings/{bindingId}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SPEC_NOT_FOUND` | 404 | Spec or ref does not exist |
| `SPEC_SLUG_CONFLICT` | 409 | Slug already exists in this org |
| `SPEC_KIND_INVALID` | 400 | Unknown spec kind |
| `SPEC_SCHEMA_INVALID` | 422 | Zod source or JSON Schema has syntax errors |
| `SPEC_VERSION_EXISTS` | 409 | Version already published |
| `OVERLAY_NOT_FOUND` | 404 | Overlay binding not found |
| `VALIDATION_FAILED` | 422 | Validation ran but content does not pass |
| `SYSTEM_SPEC_IMMUTABLE` | 403 | Cannot modify/delete system specs |

---

**Previous**: [Overlays](./03-overlays.md)  
**Back to**: [Templates Overview](./index.md)
