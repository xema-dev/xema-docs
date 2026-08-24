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
    selfCorrectionAttempted: false,
  },
}
```

`deliverable.content.value` IS the validated JSON payload. Sub-fields (`value.changeUnits`, `value.problemLandscape`) are available directly to downstream expressions.

## What validation catches

- Missing `changeUnits` field → `SCHEMA_VIOLATION` with the JSON Pointer `/changeUnits`.
- `changeUnits` is a string instead of an array → `SCHEMA_VIOLATION` with the path.
- Agent emitted markdown instead of JSON → `MALFORMED_JSON`.

Each triggers the self-correction loop with a deterministic correction prompt naming the exact violation.

---

**Previous**: [← Document Template](./01-document-template.md)
**Next**: [Code into a repo →](./03-code-into-repo.md)
