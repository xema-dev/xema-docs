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
    uses: xema/agent
    with:
      agentRef: architecture
      stageKey: architecture
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
  },
}
```

Downstream consumers read pages individually via `${{ needs.architecture.outputs.deliverable.content.pages }}` (the array) or pin a specific artifact by index off `outputs.deliverables[0]` for the publish step.

## Validating the result

Validation is a job of its own. Add `xema/validate-deliverables` between the producing job and the publish, and gate the publish on its verdict:

```yaml
  validate:
    needs: [architecture]
    uses: xema/validate-deliverables@1.0.2
    with:
      deliverableSpecRef: architecture-standard
      strictness: standard
      artifactIds:
        - ${{ needs.architecture.outputs.deliverables[0].artifactId }}
    outputs:
      verdict: ${{ job.outputs.verdict }}
      issues: ${{ job.outputs.issues }}
```

`publish` then declares `needs: [architecture, validate]` and `if: ${{ needs.validate.outputs.verdict == 'pass' }}`.

The validator's built-in rules are artifact-count rules — it does not verify page-slug coverage today. A document spec that needs a floor states it as `rules.minArtifactCount`; producing fewer than that surfaces an `INSUFFICIENT_ARTIFACTS` issue and a `fail` verdict. See [04 Validation](../04-validation.md).

---

**Previous**: [← Examples Overview](./index.md)
**Next**: [JSON schema →](./02-json-schema.md)
