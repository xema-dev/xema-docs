# Example: JSON Schema

A clarification step that emits a structured handoff package matching a JSON Schema. Downstream jobs read individual fields off the validated payload.

---

## Spec

```json
{
  "ref": "handoff-package",
  "kind": "json-schema",
  "outputContract": {
    "title": "Handoff Package",
    "mode": "workspace-files",
    "targetSlot": { "kind": "deliverables" },
    "files": [
      {
        "canonicalPath": "handoff.json",
        "required": true,
        "purpose": "Structured handoff with change units, problem landscape, and constraints.",
        "contentKind": "json"
      }
    ]
  },
  "contentSchema": {
    "type": "object",
    "required": ["changeUnits", "problemLandscape"],
    "properties": {
      "changeUnits": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["id", "title"],
          "properties": {
            "id": { "type": "string" },
            "title": { "type": "string" }
          }
        }
      },
      "problemLandscape": { "type": "string" }
    }
  }
}
```

## Workflow

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: json-schema-example
  version: 1.0.0
on:
  workflow_dispatch:
    inputs:
      request:
        type: string
        required: true
permissions:
  artifacts: write
jobs:
  clarify:
    title: Clarify request and emit handoff package
    uses: xema/agent
    with:
      agentRef: clarification-coordinator
      stageKey: clarification
      deliverableSpecRef: handoff-package
      agentSession: true
      agentContext:
        prompt: ${{ inputs.request }}
    outputs:
      changeUnits: ${{ job.outputs.deliverable.content.value.changeUnits }}
      handoffPackage: ${{ job.outputs.deliverable.content.value }}
      problemLandscape: ${{ job.outputs.deliverable.content.value.problemLandscape }}

  per-cu:
    needs: [clarify]
    strategy:
      dynamic:
        from: ${{ needs.clarify.outputs.changeUnits }}
        as: changeUnit
        keyBy: id
        maxEntries: 32
    uses: xema/agent
    with:
      agentRef: requirements
      stageKey: requirements
      changeUnitId: ${{ matrix.changeUnit.id }}
      deliverableSpecRef: requirements-standard
      agentSession: false
      agentContext:
        changeUnit: ${{ matrix.changeUnit }}
        handoffPackage: ${{ needs.clarify.outputs.handoffPackage }}
```

## Reading the result

```ts
// Producing job (clarify)
agentResult: {
  deliverable: {
    specRef: 'handoff-package',
    kind: 'json-schema',
    targetSlot: { kind: 'deliverables' },
    content: {
      kind: 'json',
      artifactId: 'art-1',
      versionId: 'ver-1',
      version: 1,
      value: {
        changeUnits: [
          { id: 'cu-1', title: 'Auth migration' },
          { id: 'cu-2', title: 'Billing rework' },
        ],
        problemLandscape: 'Legacy SSO blocks SaaS rollout...',
      },
    },
  },
}
```

`deliverable.content.value` IS the validated JSON payload. Sub-fields (`value.changeUnits`, `value.problemLandscape`) are available directly to downstream expressions.

## Where the schema is enforced

The `contentSchema` is enforced at **harvest time**, as discovery. The harvester walks the paths the spec's output contract declares, parses each as JSON, and asks `deliverable-specs-api` which candidate matches — Ajv (Draft 2020-12) compiles the schema and validates the payload. A file that does not match is rejected as a candidate with a recorded reason:

- Missing `changeUnits`, or `changeUnits` typed as a string → `SCHEMA_MISMATCH`, with the JSON Pointer.
- The file parsed but is not a JSON object → `NOT_OBJECT`.
- Markdown where JSON was declared → the candidate does not parse and is skipped.

When no candidate matches, the harvester returns no structured value and records a warning naming every path it tried. It does not throw; `clarify.outputs.changeUnits` is then simply absent for downstream jobs.

To turn that into a gate the workflow can branch on, add an `xema/validate-deliverables` job downstream. See [04 Validation](../04-validation.md).

---

**Previous**: [← Document Template](./01-document-template.md)
**Next**: [Code into a repo →](./03-code-into-repo.md)
