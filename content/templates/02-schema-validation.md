# Schema Validation

> API Docs: https://deliverable-specs-api.xema.dev/api/docs

Three spec kinds in Xema use explicit schemas for validation: `ZOD_SCHEMA`, `JSON_SCHEMA`, and `STRUCTURED_JSON`. Use these when your agent needs to produce structured data — not prose documents.

---

## `ZOD_SCHEMA`

Define a TypeScript [Zod](https://zod.dev) schema as the spec's validation contract. Agents produce JSON output that is validated against this schema at runtime.

### When to Use

- You want type-safe, expressive validation with helpful error messages
- The output is consumed by another service or workflow job
- You need complex validation logic (cross-field, custom refinements)
- Your team already uses Zod in the codebase

### Writing the Schema

The schema is stored as a TypeScript string in `zodSchemaSource`. It must export a default Zod schema or a named export called `schema`:

```typescript
import { z } from 'zod';

const RequirementSchema = z.object({
  id: z.string().regex(/^REQ-\d{3,}$/),
  title: z.string().min(5).max(200),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(20),
  acceptanceCriteria: z.array(z.string()).min(1, 'At least one AC required'),
  estimatedEffort: z.enum(['xs', 's', 'm', 'l', 'xl']).optional(),
});

export const schema = z.object({
  projectName: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  date: z.string().datetime(),
  requirements: z.array(RequirementSchema).min(1, 'At least one requirement needed'),
  assumptions: z.array(z.string()).optional(),
  constraints: z.array(z.object({
    type: z.enum(['technical', 'business', 'regulatory', 'timeline']),
    description: z.string(),
  })).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
});
```

### Creating a Zod Schema Spec

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "requirements-schema",
    "kind": "ZOD_SCHEMA",
    "title": "Requirements Schema (Validated)",
    "zodSchemaSource": "import { z } from '\''zod'\'';\n\nexport const schema = z.object({\n  projectName: z.string(),\n  requirements: z.array(z.object({\n    id: z.string(),\n    title: z.string()\n  }))\n});"
  }'
```

### Example Validation Output

Valid output:

```json
{
  "verdict": "pass",
  "issues": []
}
```

Schema violation:

```json
{
  "verdict": "fail",
  "issues": [
    {
      "field": "requirements[0].id",
      "severity": "error",
      "message": "Invalid — must match /^REQ-\\d{3,}$/"
    },
    {
      "field": "requirements[0].acceptanceCriteria",
      "severity": "error",
      "message": "At least one AC required"
    }
  ]
}
```

### Advanced: Cross-Field Validation

Use Zod `.refine()` for logic that spans multiple fields:

```typescript
export const schema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  budget: z.number().positive(),
  budgetCurrency: z.string().length(3),
}).refine(
  data => new Date(data.endDate) > new Date(data.startDate),
  {
    message: 'endDate must be after startDate',
    path: ['endDate'],
  }
).refine(
  data => !(data.budget > 1_000_000 && data.budgetCurrency === 'USD'),
  {
    message: 'Budgets over $1M require finance approval — use a different spec',
    path: ['budget'],
  }
);
```

---

## `JSON_SCHEMA`

Standard [JSON Schema Draft 2020-12](https://json-schema.org/). Good for language-agnostic validation, when tooling outside of TypeScript needs to validate the same data, or when you prefer a declarative JSON format over TypeScript.

### When to Use

- Output needs to be validated by non-TypeScript consumers
- You want to publish the schema as an OpenAPI component
- The validation rules are straightforward and don't need procedural logic
- External compliance systems provide their own JSON Schema

### Example: Deployment Configuration

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "DeploymentConfig",
  "description": "Configuration for service deployment",
  "type": "object",
  "required": ["serviceName", "environment", "image"],
  "properties": {
    "serviceName": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9-]*$",
      "maxLength": 63,
      "description": "DNS-safe service name"
    },
    "environment": {
      "type": "string",
      "enum": ["development", "staging", "production"]
    },
    "image": {
      "type": "object",
      "required": ["repository", "tag"],
      "properties": {
        "repository": { "type": "string" },
        "tag": { "type": "string" },
        "pullPolicy": {
          "type": "string",
          "enum": ["Always", "IfNotPresent", "Never"],
          "default": "IfNotPresent"
        }
      }
    },
    "replicas": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10,
      "default": 1
    },
    "resources": {
      "type": "object",
      "properties": {
        "requests": { "$ref": "#/$defs/ResourceSpec" },
        "limits": { "$ref": "#/$defs/ResourceSpec" }
      }
    },
    "env": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "value"],
        "properties": {
          "name": { "type": "string" },
          "value": { "type": "string" }
        }
      }
    },
    "healthCheck": {
      "type": "object",
      "properties": {
        "path": { "type": "string" },
        "port": { "type": "integer" },
        "initialDelaySeconds": { "type": "integer", "minimum": 0 }
      }
    }
  },
  "$defs": {
    "ResourceSpec": {
      "type": "object",
      "properties": {
        "cpu": { "type": "string", "pattern": "^\\d+(m|)$" },
        "memory": { "type": "string", "pattern": "^\\d+(Mi|Gi)$" }
      }
    }
  }
}
```

### Creating a JSON Schema Spec

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "slug": "deployment-config",
    "kind": "JSON_SCHEMA",
    "title": "Deployment Configuration Schema",
    "jsonSchema": {
      "$schema": "https://json-schema.org/draft/2020-12/schema",
      "type": "object",
      "required": ["serviceName", "environment"],
      ...
    }
  }'
```

### JSON Schema Features Supported

| Feature | Supported |
|---------|-----------|
| `type` | ✓ |
| `required` | ✓ |
| `properties` | ✓ |
| `enum` | ✓ |
| `pattern` (regex) | ✓ |
| `minimum` / `maximum` | ✓ |
| `minLength` / `maxLength` | ✓ |
| `$ref` | ✓ |
| `$defs` | ✓ |
| `if` / `then` / `else` | ✓ |
| `oneOf` / `anyOf` / `allOf` | ✓ |
| `not` | ✓ |
| `unevaluatedProperties` | ✓ |

---

## `STRUCTURED_JSON`

The most flexible kind. Validation is hint-based rather than schema-based — useful when you need guidance and consistency without strict machine enforcement.

### When to Use

- Output is semi-structured (not all fields always present)
- You want to guide agents with rules but allow variation
- Teams are still discovering what the exact structure should be
- The output is primarily human-consumed (meetings, logs, retrospectives)

### Example: Sprint Retrospective Notes

```json
{
  "slug": "sprint-retrospective",
  "kind": "STRUCTURED_JSON",
  "title": "Sprint Retrospective Notes",
  "rules": {
    "required_keys": ["sprint_number", "date", "attendees", "went_well", "improvements", "action_items"],
    "hints": [
      "Each action_item must have: owner (person), description, due_date",
      "went_well and improvements should each have 3–7 items",
      "attendees should use full names or email addresses",
      "sprint_number should be an integer"
    ],
    "validation_strictness": "warn"
  }
}
```

### Example: Meeting Notes

```json
{
  "slug": "meeting-notes",
  "kind": "STRUCTURED_JSON",
  "title": "Meeting Notes Template",
  "rules": {
    "required_keys": ["date", "attendees", "agenda", "discussion", "decisions", "action_items"],
    "hints": [
      "decisions must have rationale",
      "action_items must have owner and deadline",
      "discussion items should reference the agenda"
    ]
  }
}
```

### Validation for STRUCTURED_JSON

Validation is advisory — violations produce `warn` rather than `fail` unless `validation_strictness: fail` is set:

```json
{
  "verdict": "warn",
  "issues": [
    {
      "field": "action_items[0]",
      "severity": "warning",
      "message": "action_item missing 'due_date' field (hint: 'Each action_item must have: owner, description, due_date')"
    }
  ]
}
```

---

## Choosing the Right Kind

| Situation | Recommended Kind |
|-----------|-----------------|
| Human-readable report or document | `DOCUMENT_TEMPLATE` |
| Typed data consumed by code | `ZOD_SCHEMA` |
| Standard data format for tooling | `JSON_SCHEMA` |
| Flexible notes or semi-structured data | `STRUCTURED_JSON` |
| Validation rules live in your own system | `ENDPOINT_FETCH` |
| None of the above | `CUSTOM` |

---

**Previous**: [Document Templates](./01-document-templates.md)  
**Next**: [Overlays](./03-overlays.md)
