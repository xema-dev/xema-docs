# Schema Validation

**Schema-based deliverable specs** define machine-readable acceptance
contracts. Use them when another workflow step or application must consume a
validated JSON value.

## Choosing a Kind

| Kind | Use it when |
|---|---|
| `ZOD_SCHEMA` | Your organization authors validation in TypeScript with Zod |
| `JSON_SCHEMA` | The same contract must work across languages and tools |
| `STRUCTURED_JSON` | The output is JSON and the spec supplies a direct JSON contract |

Use `MARKDOWN_DOCUMENT` for human-readable documents and optionally select
construction guidance with `templateBinding`.

## Zod Schema

`ZOD_SCHEMA` stores the authoritative Zod module source. The module must export
a schema that validates the produced value.

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "requirements-schema",
    "version": "1.0.0",
    "title": "Requirements schema",
    "kind": "ZOD_SCHEMA",
    "category": "requirements",
    "zodSchemaSource": "import { z } from '\''zod'\'';\nexport const schema = z.object({ projectName: z.string().min(1), requirements: z.array(z.string()).min(1) });"
  }'
```

## JSON Schema

`JSON_SCHEMA` stores a JSON Schema document as JSON text. It is the portable
choice when producers and consumers use different languages.

```bash
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "risk-assessment",
    "version": "1.0.0",
    "title": "Risk assessment",
    "kind": "JSON_SCHEMA",
    "category": "risk",
    "content": "{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"level\",\"summary\"],\"properties\":{\"level\":{\"enum\":[\"low\",\"medium\",\"high\"]},\"summary\":{\"type\":\"string\",\"minLength\":1}}}"
  }'
```

## Inference Enforcement

For a supported single-JSON-document contract, set
`rules.enforceViaInference: true` to validate structured output as it is
produced as well as at the harvested-file boundary. This does not replace final
deliverable validation.

## Failure Behaviour

Malformed schema source, an unsupported body for the selected kind, and output
that fails the contract are explicit errors. Xema does not reinterpret invalid
JSON as a document or silently switch to a different spec kind.

---

**Previous**: [← Document Templates](./01-document-templates.md)

**Next**: [Overlays →](./03-overlays.md)
