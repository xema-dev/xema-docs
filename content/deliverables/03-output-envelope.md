# Agent output envelope

The `xema/agent` action separates execution metadata from the values a workflow carries between jobs; large reviewable content remains in the artifact store.

---

## Current Agent outputs

Declared by `xema/agent@3.0.0`:

| Output | Shape | Meaning |
|---|---|---|
| `allocationId` | `string` | Runtime allocation used for the job |
| `outcome` | enum | `succeeded`, `empty-response`, or `partial` |
| `structuredOutput` | `ArtifactRef` or `null` | The agent's structured handoff, promoted to a `json_payload` artifact |
| `agentResult` | object or `null` | The same handoff, unpromoted |
| `response` | `ArtifactRef` or `null` | Declared as a `markdown_doc` promotion. Always `null` today — see below |
| `deliverables` | array | Declared, but always empty — see below |
| `durationMs` | integer | Execution duration |
| `sessionId` | string or `null` | Workflow-linked Session id |
| `workspaceId` | string or `null` | Durable Workspace a later Agent job may attach to |

`workerName`, `workerUrl`, `workerProxyUrl` and `allocationStatus` are also declared; they address the runtime allocation and are rarely projected.

**`structuredOutput` is the one artifact a workflow agent job produces.** It is the JSON the session posts to its handoff endpoint, promoted to a `json_payload` artifact reference carrying `artifactId`, `versionId`, `version`, `hash` and `type`.

**`deliverables` is always an empty array.** It was the harvest of files the agent wrote into its workspace. The harvester is not constructed by anything, so nothing populates it. There is no singular `deliverable` output — expressions reading `job.outputs.deliverable` do not resolve.

**`response` is always `null`.** The handoff path produces no closing free-text message, so the `markdown_doc` promotion has nothing to promote.

---

## Projecting outputs from a job

```yaml
jobs:
  draft:
    uses: xema/agent@3.0.0
    with:
      agentRef: requirements@3
      deliverableSpecRef: feature-spec@2
      agentContext:
        prompt: Draft the feature specification.
    outputs:
      spec: ${{ job.outputs.structuredOutput }}
      sessionId: ${{ job.outputs.sessionId }}
```

Downstream jobs read projected values through `needs.<job>.outputs.<name>`:

```yaml
jobs:
  publish:
    needs: [draft]
    uses: customer/publish-feature-spec@1.0.0
    with:
      spec: ${{ needs.draft.outputs.spec }}
```

## Publishing an agent's output to the knowledge base

There is no path from a workflow agent job to a KB page today.

`xema/publish-kb` takes either an inline `markdown` body or an `artifactId`. The `artifactId` branch resolves the artifact version, requires `mode: 'inline'`, and reads `payload.body` — the shape the harvester used to emit for document pages. A `json_payload` handoff artifact carries no `body`, so that branch refuses it.

The inline `markdown` input still works for content the workflow supplies itself. It cannot be piped from `outputs.response`, which is always `null`.

## Matrix outputs

Dynamic and matrix jobs can expose iteration outputs by key. The same output shape applies inside every iteration:

```yaml
jobs:
  build:
    strategy:
      dynamic:
        from: ${{ needs.plan.outputs.targets }}
        as: target
        keyBy: name
    uses: xema/agent@3.0.0
    with:
      agentRef: builder@4
      deliverableSpecRef: ${{ matrix.target.specRef }}
      agentContext:
        prompt: ${{ matrix.target.prompt }}
    outputs:
      result: ${{ job.outputs.structuredOutput }}
```

## Why references and hashes matter

- The promoted handoff has a stable id, version and hash.
- Workflow history stays compact because large content does not need to be copied through every event.
- Downstream jobs can pin the exact artifact version they consumed.
- A structured handoff preserves business contracts across Agent, Workflow, and application boundaries.

---

**Previous**: [← Authoring](./02-authoring.md)
**Next**: [Validation →](./04-validation.md)
