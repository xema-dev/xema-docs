# Agent output envelope

The current `xema/agent@2.1.0` action separates execution metadata, harvested artifacts, and the optional typed deliverable. Workflow authors pass references and structured values between jobs; large reviewable content remains in the artifact store.

---

## Current Agent outputs

| Output | Shape | Meaning |
|---|---|---|
| `allocationId` | `string` | Runtime allocation used for the job |
| `outcome` | enum | `succeeded`, `empty-response`, or `partial` |
| `deliverables` | `DeliverableArtifactRef[]` | Files harvested from the Agent workspace |
| `deliverable` | object or `null` | The typed deliverable governed by `deliverableSpecRef` |
| `renderedContextHash` | string or `null` | Hash of the rendered invocation context |
| `resolvedAgentSnapshotHash` | string or `null` | Hash of the resolved Agent snapshot |
| `mountDiagnostic` | object or `null` | Workspace-mount diagnostic |
| `durationMs` | integer | Execution duration |
| `sessionId` | string or `null` | Workflow-linked Session id when `agentSession: true` |

Each item in `deliverables` is a stable, versioned artifact reference containing fields such as `artifactId`, `versionId`, `version`, `hash`, `path`, `sizeBytes`, and `sha256`.

The singular `deliverable` carries the structured result selected by the deliverable specification. Its envelope includes the specification reference, kind, target slot, content, and whether self-correction was attempted.

---

## Projecting outputs from a job

```yaml
jobs:
  draft:
    uses: xema/agent@2.1.0
    with:
      agentRef: requirements@3
      deliverableSpecRef: feature-spec@2
      agentContext:
        prompt: Draft the feature specification.
    outputs:
      spec: ${{ job.outputs.deliverable }}
      artifacts: ${{ job.outputs.deliverables }}
      agentSnapshotHash: ${{ job.outputs.resolvedAgentSnapshotHash }}
```

Downstream jobs read projected values through `needs.<job>.outputs.<name>`:

```yaml
jobs:
  publish:
    needs: [draft]
    uses: customer/publish-feature-spec@1.0.0
    with:
      spec: ${{ needs.draft.outputs.spec }}
      supportingArtifacts: ${{ needs.draft.outputs.artifacts }}
```

## Reading a harvested artifact

```yaml
jobs:
  publish-first-artifact:
    needs: [draft]
    uses: xema/publish-kb@1.2.3
    with:
      spaceSlug: specifications
      slug: feature-spec
      title: Feature specification
      artifactId: ${{ needs.draft.outputs.artifacts[0].artifactId }}
      versionId: ${{ needs.draft.outputs.artifacts[0].versionId }}
      version: ${{ needs.draft.outputs.artifacts[0].version }}
```

## Matrix outputs

Dynamic and matrix jobs can expose iteration outputs by key. The same `deliverable` and `deliverables` shapes apply inside every iteration:

```yaml
jobs:
  build:
    strategy:
      dynamic:
        from: ${{ needs.plan.outputs.targets }}
        as: target
        keyBy: name
    uses: xema/agent@2.1.0
    with:
      agentRef: builder@4
      deliverableSpecRef: ${{ matrix.target.specRef }}
      agentContext:
        prompt: ${{ matrix.target.prompt }}
    outputs:
      result: ${{ job.outputs.deliverable }}
```

## Why references and hashes matter

- Reviewable files have stable ids, versions, hashes, and paths.
- Workflow history stays compact because large content does not need to be copied through every event.
- Downstream jobs can pin the exact artifact version they consumed.
- The resolved Agent and rendered-context hashes make an execution easier to reproduce and audit.
- Structured deliverables preserve business contracts across Agent, Workflow, and application boundaries.

---

**Previous**: [← Authoring](./02-authoring.md)
**Next**: [Validation & Self-Correction →](./04-validation-and-self-correction.md)
