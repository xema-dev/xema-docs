# Example: Matrix Mixed Kinds

The "5 microservices + 1 frontend" case. A clarification step decides what to build, and a matrix downstream produces a different number of deliverables of mixed kinds — without any new DSL primitive.

---

## The shape of the upstream output

The clarification agent emits an array of build targets, each carrying its own `specRef` plus a unique `name` for the matrix key:

```json
{
  "targets": [
    { "name": "auth",    "kind": "microservice", "specRef": "microservice-template", "prompt": "Auth service for OAuth2 + JWT issuance" },
    { "name": "billing", "kind": "microservice", "specRef": "microservice-template", "prompt": "Billing service with Stripe webhook ingestion" },
    { "name": "search",  "kind": "microservice", "specRef": "microservice-template", "prompt": "Search service backed by OpenSearch" },
    { "name": "users",   "kind": "microservice", "specRef": "microservice-template", "prompt": "User profile + preferences service" },
    { "name": "audit",   "kind": "microservice", "specRef": "microservice-template", "prompt": "Audit log ingestion + query service" },
    { "name": "web",     "kind": "frontend",     "specRef": "frontend-template",     "prompt": "Customer dashboard with auth, billing, profile pages" }
  ]
}
```

Five microservices, one frontend — six entries total. A different request would produce a different array.

## Workflow

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: matrix-mixed-kinds-example
  version: 1.0.0
on:
  workflow_dispatch:
    inputs:
      request:
        type: string
        required: true
permissions:
  artifacts: write
  repos: write
jobs:
  clarify:
    title: Decide what to build
    uses: xema/agent@1.1.0
    with:
      agentSlug: clarification-coordinator
      role: clarification-coordinator
      phaseKey: clarification
      mounts:
        references: true
        deliverables: { mode: read-write }
        deliverable-specs: true
      deliverableSpecRef: build-plan
      agentSession: true
      agentContext:
        prompt: ${{ inputs.request }}
    outputs:
      targets: ${{ job.outputs.deliverable.content.value.targets }}

  build:
    title: Build each target
    needs: [clarify]
    strategy:
      dynamic:
        from: ${{ needs.clarify.outputs.targets }}
        as: target
        keyBy: name
        maxEntries: 16
      maxParallel: 4
    uses: xema/agent@1.1.0
    with:
      agentSlug: builder
      role: engineer
      phaseKey: build
      changeUnitId: ${{ matrix.target.name }}
      mounts:
        references: true
        repos: { mode: read-write }
        deliverable-specs: true
      deliverableSpecRef: ${{ matrix.target.specRef }}
      agentSession: false
      agentContext:
        target: ${{ matrix.target }}
        prompt: ${{ matrix.target.prompt }}
    permissions:
      repos: write
    outputs:
      deliverables: ${{ job.outputs.deliverables }}
      deliverable: ${{ job.outputs.deliverable }}

  publish-summary:
    needs: [build]
    matrixGather: [build]
    uses: xema/agent@1.1.0
    with:
      agentSlug: governance
      role: coordinator
      phaseKey: governance
      mounts:
        references: true
        deliverables: { mode: read-only }
      deliverableSpecRef: build-summary
      agentSession: false
      agentContext:
        builtTargets: ${{ needs.build.outputs }}
```

## Why this works without new primitives

1. **`deliverableSpecRef` is expression-shaped.** Each iteration's `${{ matrix.target.specRef }}` resolves to a different spec at dispatch time. The runtime fetches each spec, drives the agent, and validates against the matching contract.
2. **`keyBy: name` exposes per-target outputs.** Downstream consumers index `needs.build.outputs.byKey[<name>]` to reach a specific target's deliverable.
3. **`matrixGather:` flattens for the cross-target step.** The summary job receives the full array of build outputs, no per-target indexing needed.
4. **Variable count is automatic.** Five targets = five iterations. Three targets = three. Zero targets = the `build` job doesn't run, and `publish-summary` (which depends on it via `matrixGather`) skips.

The matrix mechanism is the single answer for "many or zero or different-kind deliverables." There's no parallel `deliverableSpecRefs: []` plural primitive — that would duplicate the fan-out concept.

## Reading per-target results

```yaml
# Inside a downstream job, read a specific target's deliverable
artifactIds: ${{ needs.build.outputs.byKey['auth'].deliverables }}
# Or read it via the matrix binding when fanning out further
artifactIds: ${{ needs.build.outputs.byKey[matrix.target.name].deliverables }}
```

For mixed-kind targets, downstream consumers may need to branch on `deliverable.kind`:

```yaml
if: ${{ needs.build.outputs.byKey[matrix.target.name].deliverable.kind == 'custom' }}
```

Use this when the per-target work depends on whether the agent produced code (custom) vs a frontend SPA (also custom but with a different post-step).

## Edge cases

- **Zero targets** — `clarify.outputs.targets` is `[]`, the matrix expands to zero iterations, no agent runs, no validation runs. Downstream `matrixGather` jobs see an empty array.
- **Duplicate `name`** — fail-fast at dispatch with `RUNTIME_MATRIX_KEY_DUPLICATE`. The `keyBy` value must be unique across iterations.
- **Cardinality cap** — `maxEntries: 16` caps the array length. An upstream returning 100 targets fails with `RUNTIME_DYNAMIC_MATRIX_OVERFLOW` rather than fanning out 100 expensive agent runs.

---

**Previous**: [← Response-only](./04-response-only.md)
