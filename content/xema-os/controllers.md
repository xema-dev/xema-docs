# Controllers

> API Docs: https://workflow-engine-api.xema.dev/api/docs

A **Controller** is a reconciliation loop that owns one or more [object kinds](./objects.md) in Xema OS. Controllers are the platform's answer to "how does state stay consistent under concurrent writes, partial failures, and out-of-order events?". They are the same pattern Kubernetes uses: read the *desired* state, observe the *current* state, drive the gap to zero, emit follow-up events. The platform does not fire-and-forget — it reconciles.

A controller is not a daemon you write ad-hoc. It is a typed, registered, observable component of the kernel control plane.

---

## The reconciliation loop

Every controller in Xema OS follows the same shape:

```
            ┌─────────────────────────────────────┐
            │   Watch (desired + observed state)  │
            └──────────────┬──────────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────────┐
            │   Diff (desired − observed)         │
            └──────────────┬──────────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────────┐
            │   Act (apply one step toward gap=0) │
            └──────────────┬──────────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────────┐
            │   Emit (CloudEvent on transition)   │
            └─────────────────────────────────────┘
                           │
                           └───── back to Watch ──────┐
                                                      │
                                                      ▼
                                              (next observation)
```

The loop is **level-triggered**, not edge-triggered: a controller reads the current state on every pass, not "the event that woke me up". An event that is missed, duplicated, or arrives out of order is not a correctness problem — the next reconciliation pass sees the same observed state and converges to the same decision.

---

## Desired state vs observed state

`Desired state` and `observed state` are typed, distinct surfaces. They are never read from the same row.

| Surface | What it holds | Where it lives |
|---|---|---|
| **Desired** | What the user / admin / upstream object asked for | The owning object's spec fields |
| **Observed** | What is actually true right now in the world | The owning object's status fields + external system probes |

A controller writes only to `status`. A human, an admin tool, or an upstream controller writes only to `spec`. This separation is enforced at the object-registry layer — a controller that tries to write `spec` is refused with `CONTROLLER_SPEC_WRITE_DENIED`.

---

## Where controllers live

A controller may be shipped two ways. The decision is uniform with every other extension surface:

| Source | Example | When to use |
|---|---|---|
| Platform service (`apps/`) | `workload-runtime-api` reconciles workload pods; `connector-gateway-api` reconciles binding tokens | The reconciliation is generic and every sub-app needs it |
| Biome contribution | A biome's manifest declares a `controller` contribution kind | The reconciliation is domain-specific (e.g. a biome that mirrors a Linear board into Xema issues) |

Biome-shipped controllers register through the manifest the same way other [contributions](./sdk/contributions.md) register. The kernel's controller registry tracks both kinds uniformly; an admin can list every controller running against the org's data with one call.

---

## What a controller declares

A controller declaration is a closed, typed record:

```ts
interface ControllerDescriptor {
  name:           string;            // 'workload-pod-reconciler', etc.
  watches:        XemaObjectKind[];  // closed enum — kinds it observes
  emits:          string[];          // CloudEvent types it publishes
  environment:    EnvironmentRef;    // the execution environment it runs under
  reconcileEvery: number;            // seconds between full passes; default 30
  maxConcurrent:  number;            // per-instance concurrent reconciliations
}
```

`watches`, `emits`, and `environment` are surfaced to the [Permission Digest](./capabilities.md) at install time: the admin sees exactly which object kinds a biome's controller will read and what events it will emit before approving the install. No controller runs unobserved.

---

## Error handling — fail-fast, retry-safe

Reconciliation errors are categorised; the dispatcher acts on the category, not on a free-form exception message:

| Outcome | Meaning | Next pass |
|---|---|---|
| `ok` | Desired = observed; nothing to do | Sleep until `reconcileEvery` |
| `progress` | One step applied; not yet converged | Re-queue immediately |
| `transient` | External dependency unavailable | Re-queue with exponential backoff |
| `permanent` | The desired state is impossible | Write `status.condition = Failed`, stop retrying, emit `<kind>.reconcile.failed.v1` |
| `conflict` | Optimistic-concurrency clash | Re-read, retry once; second clash → `transient` |

There is no silent retry-forever, no swallow-and-log, no "best-effort" path. A `permanent` failure surfaces on the object's `status` and in the audit log — the human gets the typed condition, not a 3 AM alert about a stuck loop.

---

## Concurrency and safety

Controllers are deployed as ordinary replicas of the owning service. The kernel guarantees:

1. **Single-writer per object.** A PG advisory lock keyed on `(kind, id)` serializes concurrent reconciliations of the same object across replicas.
2. **At-most-one action per pass.** A pass that diffs five missing sub-resources creates one, then returns `progress`. The next pass creates the second. This keeps every step idempotent and rollback-friendly.
3. **Reconciliation budgets.** A controller that exceeds its declared `maxConcurrent` queues subsequent objects; it does not fan out unbounded.

These are platform guarantees, not biome responsibilities — a biome-shipped controller that simply implements the `Controller` interface gets them for free.

---

## Controllers you can already name

The kernel ships several first-party controllers; they are the working examples of the pattern:

| Controller | Watches | Drives |
|---|---|---|
| Workload reconciler (`workload-runtime-api`) | `Workload` | Pod desired-state → observed pod state |
| Binding reconciler (`connector-gateway-api`) | `ConnectorBinding` | Credential `ready` / `degraded` / `revoked` transitions |
| Biome lifecycle reconciler (`biome-host-api`) | `BiomeInstallation` | The seven-state install lifecycle |
| Workflow run reconciler (`workflow-engine-api`) | `WorkflowRun` | Run status from job-run observations |

All four expose their reconcile-failure events through the same CloudEvent registry the [Service Registry](./service-registry.md) advertises. A biome that wants to react to "the workload pod for my session died" subscribes to the workload reconciler's `workload.reconcile.failed.v1` and gets the typed envelope — no polling, no scraping.

---

## When a controller is the wrong tool

Controllers are for state convergence. They are the wrong fit for:

- **Stream processing.** A controller is level-triggered; it does not see every event. Use a CloudEvent subscription instead.
- **Interactive request/response.** A controller does not return a value to a caller. Use a capability call.
- **Cron-style scheduled work.** A controller fires on state change, not on the clock. Use a scheduled workflow.

If a proposed feature reads as "every N minutes, do X regardless of state", it is not a controller — it is a [scheduled workflow](./capabilities.md). If a feature reads as "keep Y matching Z", it is a controller.

---

## Related concepts

- [Runners](./runners.md) — controllers dispatch their action steps through the same runner abstraction every capability uses.
- [Service Registry](./service-registry.md) — controllers register their descriptor at boot and renew a lease the same way services do.
- [Objects](./objects.md) — every controller watches a closed set of `XemaObjectKind`s and writes only `status`.
- [Capabilities](./capabilities.md) — the action a controller takes is itself a capability invocation, mediated by policy.

---

**Previous**: [← Runners](./runners.md)
**Next**: [Service Registry →](./service-registry.md)
