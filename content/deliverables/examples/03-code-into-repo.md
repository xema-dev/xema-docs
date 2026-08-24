# Example: Code into a Repo

Emit code files directly into a working repo (clone) using `targetSlot.kind: 'repos'`. The harvester writes artifacts under the repo namespace.

---

## Spec

```json
{
  "ref": "engineering-standard",
  "kind": "custom",
  "outputContract": {
    "title": "Engineering Implementation",
    "mode": "workspace-files",
    "targetSlot": {
      "kind": "repos",
      "repoSlug": "my-service"
    },
    "notes": "Agent writes source files, configs, and migrations under the repo working copy. Repo slug is supplied by the workflow context."
  }
}
```

The `custom` kind doesn't constrain individual file paths — the agent is free to add, modify, or delete files in the repo working copy. Validation only checks that *some* files were written.

For tighter contracts (e.g. "must touch these specific files"), use `custom` with an explicit `files[]` block listing required paths.

## Workflow

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: code-emission-example
  version: 1.0.0
on:
  workflow_dispatch:
    inputs:
      changeRequest:
        type: string
        required: true
permissions:
  artifacts: write
  repos: write
jobs:
  engineer:
    title: Engineering implementation
    uses: xema/agent
    with:
      agentRef: engineering
      stageKey: engineering
      deliverableSpecRef: engineering-standard
      agentSession: false
      agentContext:
        prompt: ${{ inputs.changeRequest }}
    permissions:
      repos: write
    outputs:
      deliverables: ${{ job.outputs.deliverables }}
      deliverable: ${{ job.outputs.deliverable }}

  open-pr:
    needs: [engineer]
    uses: software-dev/scm-open-pr@1.0.0
    with:
      repoSlug: my-service
      branch: ${{ format('xema/{0}', xema.run.id) }}
      artifactIds: ${{ needs.engineer.outputs.deliverables }}
```

## Reading the result

```ts
agentResult: {
  deliverable: {
    specRef: 'engineering-standard',
    kind: 'custom',
    targetSlot: { kind: 'repos', repoSlug: 'my-service' },
    content: {
      kind: 'custom',
      files: [
        { path: '/workspace/repos/my-service/src/handler.ts',
          artifactId: 'art-1', versionId: 'ver-1', version: 1,
          contentKind: 'text', sizeBytes: 1840 },
        { path: '/workspace/repos/my-service/test/handler.test.ts',
          artifactId: 'art-2', versionId: 'ver-2', version: 1,
          contentKind: 'text', sizeBytes: 920 },
        { path: '/workspace/repos/my-service/migrations/2026-05-01-init.sql',
          artifactId: 'art-3', versionId: 'ver-3', version: 1,
          contentKind: 'text', sizeBytes: 412 },
      ],
    },
    selfCorrectionAttempted: false,
  },
}
```

The downstream `scm-open-pr` action consumes the artifact ids to build a PR with all written files.

## What validation catches

- Agent wrote files outside `/workspace/repos/my-service/` → `WRONG_TARGET_SLOT`.
- Agent wrote no files at all → `MISSING_FILE`.

A `WRONG_TARGET_SLOT` failure includes the misplaced paths in the actual summary, so the correction prompt names them explicitly.

## Tighter contracts

Add a `files[]` block to require specific paths exist:

```json
"files": [
  {
    "canonicalPath": "src/handler.ts",
    "required": true,
    "purpose": "Main request handler",
    "contentKind": "text"
  }
]
```

Now the harvester verifies `src/handler.ts` is among the written files. Missing it produces a `MISSING_FILE` reason naming the path.

---

**Previous**: [← JSON schema](./02-json-schema.md)
**Next**: [Response-only →](./04-response-only.md)
