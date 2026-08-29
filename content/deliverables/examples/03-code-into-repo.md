# Example: Code into a Repo

Emit code files directly into a working repo (clone) using `targetSlot.kind: 'repos'`.

> **Not runnable today.** This example depends on the workspace harvest, which
> is not running: files the agent writes into the repo working copy do not
> become artifacts, so `open-pr` has no artifact ids to build a PR from. The
> spec and its `targetSlot` are still valid. See
> [the note on the section index](../index.md).

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
      handoff: ${{ job.outputs.structuredOutput }}
```

An `open-pr` job consuming `outputs.deliverables` used to follow here. It is
removed rather than rewritten: that output no longer exists, so the job would
name a field the action does not declare and open a pull request over no
files.

## Reading the result

This is the envelope the harvest was designed to expose. **It is not produced
today** — shown so the spec's intent is legible, not as something to consume:

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
  },
}
```

A downstream `scm-open-pr` action would consume those artifact ids to build a PR with all written files.

## Validating the result

`xema/validate-deliverables` is live and checks artifact counts, so it is what
would make "the agent wrote nothing usable" visible. With the harvest not
running there are no file artifacts to count, so a `custom` spec validated this
way returns `fail` with `INSUFFICIENT_ARTIFACTS` on every run — not because the
agent misbehaved, but because nothing collects what it wrote. See
[04 Validation](../04-validation.md).

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

`files[]` is the list of paths the harvest was to consider, in order, when
looking for the deliverable. It is part of the spec contract and is still
stored and served; nothing walks it today.

---

**Previous**: [← JSON schema](./02-json-schema.md)
**Next**: [Response-only →](./04-response-only.md)
