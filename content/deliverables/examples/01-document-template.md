# Example: Document Template

A multi-page architecture document. The agent writes `manifest.json` + per-page markdown files. Downstream jobs consume the page list.

---

## Spec

The spec lives in deliverable-specs-api with kind `document-template`:

```json
{
  "ref": "architecture-standard",
  "kind": "document-template",
  "outputContract": {
    "title": "Architecture Standard",
    "mode": "workspace-files",
    "targetSlot": { "kind": "deliverables" },
    "multiPage": {
      "manifestPath": "manifest.json",
      "pagePathTemplate": "pages/<slug>.md",
      "pages": [
        { "slug": "overview",     "title": "Overview" },
        { "slug": "components",   "title": "Components" },
        { "slug": "data-model",   "title": "Data Model" },
        { "slug": "deployment",   "title": "Deployment" }
      ]
    }
  }
}
```

## Workflow

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: document-template-example
  version: 1.0.0
on:
  workflow_dispatch:
    inputs:
      request:
        type: string
        required: true
permissions:
  artifacts: write
  kb: write
jobs:
  architecture:
    title: Build architecture document
    uses: xema/agent@1.1.0
    with:
      agentSlug: architecture
      role: unit-worker
      phaseKey: architecture
      mounts:
        references: true
        deliverables: { mode: read-write }
        deliverable-specs: true
      deliverableSpecRef: architecture-standard
      agentSession: false
      agentContext:
        prompt: ${{ inputs.request }}
    outputs:
      deliverables: ${{ job.outputs.deliverables }}
      deliverable: ${{ job.outputs.deliverable }}

  publish:
    needs: [architecture]
    uses: xema/publish-kb@1.2.1
    with:
      spaceSlug: architecture
      spaceTitle: Architecture
      createSpaceIfMissing: true
      slug: ${{ format('arch-{0}', xema.run.id) }}
      title: Architecture deliverable
      artifactId: ${{ needs.architecture.outputs.deliverables[0].artifactId }}
      versionId: ${{ needs.architecture.outputs.deliverables[0].versionId }}
      version: ${{ needs.architecture.outputs.deliverables[0].version }}
```

## Reading the result

The producing job exposes:

```ts
agentResult: {
  deliverable: {
    specRef: 'architecture-standard',
    kind: 'document-template',
    targetSlot: { kind: 'deliverables' },
    content: {
      kind: 'document',
      manifestPath: 'deliverables/manifest.json',
      pages: [
        { slug: 'overview', title: 'Overview', artifactId: 'art-1', versionId: 'ver-1', version: 1 },
        { slug: 'components', title: 'Components', artifactId: 'art-2', versionId: 'ver-2', version: 1 },
        { slug: 'data-model', title: 'Data Model', artifactId: 'art-3', versionId: 'ver-3', version: 1 },
        { slug: 'deployment', title: 'Deployment', artifactId: 'art-4', versionId: 'ver-4', version: 1 },
      ],
    },
    selfCorrectionAttempted: false,
  },
}
```

Downstream consumers read pages individually via `${{ needs.architecture.outputs.deliverable.content.pages }}` (the array) or pin a specific artifact by index off `outputs.deliverables[0]` for the publish step.

## What validation catches

If the agent returns three pages but the spec declared four, validation fails with `MISSING_PAGE` and triggers the self-correction loop. The agent receives a correction message naming the missing slug and asking for a focused fix.

---

**Previous**: [← Examples Overview](./index.md)
**Next**: [JSON schema →](./02-json-schema.md)
