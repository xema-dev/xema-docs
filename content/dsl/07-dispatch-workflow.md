# Dispatch Workflow (`xema/dispatch-workflow`)

The **dispatch-workflow action** starts a brand-new top-level workflow run from inside a running workflow. It is how one workflow hands work to another — spawning a remediation run on a failed review, or fanning a portfolio initiative out into many parallel delivery runs.

This page documents the full input surface for `xema/dispatch-workflow`. For the broader DSL grammar see [DSL Reference](./01-reference.md).

---

## Minimal usage

```yaml
jobs:
  spawn-follow-up:
    uses: xema/dispatch-workflow
    with:
      executionKind: activity
      targetWorkflowSlug: nightly-audit
      inputs:
        request: "Run the nightly audit"
```

`executionKind`, `targetWorkflowSlug`, and `inputs` are the fields you will set on almost every dispatch job. `inputs` is passed verbatim as the spawned run's `workflow_dispatch` inputs and is validated against that workflow's own input schema.

Omitting `@<version>` pins the action to its current published version at compile time. To lock a specific version, append an exact semver — `uses: xema/dispatch-workflow@3.0.0`.

---

## When to use it

Xema gives you two ways to run one workflow from another:

| Mechanism | Behaviour |
|---|---|
| `uses: xema://workflow/<slug>` | **Reusable workflow.** Expands inline at compile time and runs as part of the parent run — one run record, shared lifecycle. |
| `uses: xema/dispatch-workflow` | **Dispatch.** Starts a *separate* top-level run with its own lifecycle, its own run-detail page, and its own concurrency group. |

Reach for `xema/dispatch-workflow` when the spawned work should be an independent run — different observability, an independent retry/failure policy, or a different concurrency lease than the parent.

---

## Execution modes

A dispatch job picks one of two modes with `executionKind`. The mode is fixed at compile time, so it **must be a literal** — `activity` or `child_workflow` — never a `${{ }}` expression.

### `activity` — fire-and-forget

The action returns as soon as the Xema Workflow Runtime confirms the new run is queued. The parent does **not** wait for it, and the spawned run's success or failure never affects the parent.

Use it when the two runs are genuinely independent — for example, a code-review workflow that spawns a remediation run on a rejected verdict and must not block its own webhook turnaround on the remediation finishing.

### `child_workflow` — await completion

The action blocks until the spawned run reaches a terminal state, then returns that run's terminal `phase` plus its per-job `childOutputs`. The parent can aggregate those outputs — typically with a `matrixGather` over a fan-out.

Use it when the parent must collect results from the runs it spawned — for example, a program workflow that splits an initiative into many parallel delivery runs and then synthesises a single report.

Omitting `executionKind` falls back to `child_workflow`: the safe default is to observe the run you spawned.

---

## Inputs

### `executionKind`

`activity` or `child_workflow` — see [Execution modes](#execution-modes). Optional; defaults to `child_workflow`. Must be a literal.

### `targetWorkflowSlug` *(required)*

The slug of the workflow to dispatch. It must be visible to the run's organization.

### `inputs` *(required)*

An object passed verbatim as the spawned run's `workflow_dispatch` inputs. It is validated against the target workflow's `on.workflow_dispatch.inputs` schema, so a missing or mistyped field fails the spawned run fast.

### `projectId`

The project the spawned run belongs to. Defaults to the parent run's project.

### `triggerReason`

A short human-readable note (up to 256 characters) recorded on the spawned run, explaining why it was dispatched. Surfaces in the run's audit trail.

### `concurrencyGroupOverride`

Overrides the spawned run's concurrency group. By default the spawned run inherits the concurrency group of the target workflow; set this when a dispatched cohort needs its own queue lease.

---

## Outputs

Every dispatch returns:

| Field | Description |
|---|---|
| `runId` | Id of the spawned run. |
| `runtimeWorkflowId` | The spawned run's workflow id in the Xema Workflow Runtime. |
| `snapshotSha256` | Content hash of the spawned run's compiled snapshot. |
| `correlationId` | Correlation id threaded onto the spawned run. |

In `child_workflow` mode the action additionally returns:

| Field | Description |
|---|---|
| `phase` | Terminal phase of the spawned run — `succeeded`, `failed`, `cancelled`, or `expired`. |
| `childOutputs` | The spawned run's per-job outputs, shaped for `matrixGather` on the parent. |

`phase` and `childOutputs` are **not** produced in `activity` mode — there is no completed run to report.

---

## Example: fire-and-forget remediation

A review workflow spawns a remediation run when the verdict is `rejected`, without waiting for it. The `timeout` override fails the dispatch fast if the Runtime call hangs.

```yaml
jobs:
  spawn-remediation:
    needs: [review]
    if: ${{ needs.review.outputs.verdict == 'rejected' }}
    uses: xema/dispatch-workflow
    timeout: 30s
    with:
      executionKind: activity
      targetWorkflowSlug: auto-remediation
      triggerReason: ${{ format('remediation for {0}', trigger.payload.changeRequestId) }}
      inputs:
        reviewFindings: ${{ needs.review.outputs.findings }}
        sourceBranch: ${{ trigger.payload.sourceBranch }}
```

---

## Example: await completion and aggregate

A program workflow fans out into one delivery run per sub-initiative, waits for all of them, then synthesises a report from the gathered outputs.

```yaml
jobs:
  dispatch-deliveries:
    needs: [program-intake]
    strategy:
      dynamic:
        from: ${{ needs.program-intake.outputs.subInitiatives }}
        as: sub
        keyBy: id
      maxParallel: 4
    uses: xema/dispatch-workflow
    with:
      executionKind: child_workflow
      targetWorkflowSlug: product-development
      inputs:
        request: ${{ matrix.sub.request }}
        projectId: ${{ matrix.sub.projectId }}
    outputs:
      childRunId: ${{ job.outputs.runId }}
      childOutputs: ${{ job.outputs.childOutputs }}

  program-synthesize:
    needs: [dispatch-deliveries]
    matrixGather: [dispatch-deliveries]
    uses: xema/agent
    with:
      agentRef: program-coordinator
      deliverableSpecRef: program-summary
      agentContext:
        prompt: Synthesize the completed delivery outputs.
```

Because the fan-out runs in `child_workflow` mode, `program-synthesize` can `matrixGather` every delivery run's outputs once they all complete.

---

## Constraints

- **`executionKind` must be a literal.** The dispatch primitive is chosen at compile time; an expression is rejected with a `DSL_SEMANTIC_INVALID` compile error.
- **Not allowed inside reusable workflows.** A reusable workflow (`xema://workflow/...`) must stay side-effect-free; dispatching a run belongs to top-level workflows only.
- **Cancellation does not cascade.** Cancelling the parent run does **not** cancel a run it dispatched — in either mode. The spawned run owns its own lifecycle. To stop a dispatched cohort, cancel each spawned run explicitly.
- **Dispatch is not retried.** Starting a run is not idempotent — a retry could spawn a duplicate. The job fails fast on a dispatch error instead. For `activity` mode, pair it with a tight `timeout:` so a hung Runtime call surfaces quickly.

---

## See also

- [DSL Reference](./01-reference.md) — full grammar
- [Review Step](./05-review.md) — the gate that often drives a remediation dispatch
- [Triggers](../workflows/04-triggers.md) — how the spawned run's `workflow_dispatch` inputs are validated

---

**Previous**: [← Agent Step](./06-agent-step.md)
