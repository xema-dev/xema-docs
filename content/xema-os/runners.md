# Runners

A **runner** is the process that actually executes a capability. The Xema OS control plane (router, authorization, audit) is uniform across deployments; the runner layer is where *physical execution* happens — inside the kernel binary, in a sidecar process, on a GPU node, on a customer-edge VM, or in a regulated on-prem environment. The choice is data-driven, not hard-coded.

The runner abstraction makes it possible to deploy the same biome to a developer's laptop, a small org's single VM, and a regulated multi-region cluster without changing a line of biome code.

---

## The three runner kinds

`RunnerKind` is a closed enum:

| Kind | Where it lives | Cost / latency | Typical use |
|---|---|---|---|
| `embedded` | Inside the kernel server process | Lowest | Built-in capabilities, shell built-ins, Concept Registry, XVFS resolution |
| `local-module` | Same node, separate process supervised by the biome host | Low | First-party biomes, dev/local sub-app processes |
| `remote` | A different machine; reached via event-hub or pull-channel | Bounded by network | GPU workloads, customer-edge, regulated/private data, scale-out |

A capability is not pinned to a runner kind at registration. **Policy** (via `routeHints.requiredRunnerKind`) chooses the kind per invocation; the router then picks a specific runner instance that matches.

---

## Runner registration

Every runner — embedded, local-module, or remote — registers itself with the kernel server through the [Service Registry](./service-registry.md):

```ts
// At runner boot
serviceRegistry.register({
  name: 'xema-runner-eu-west-gpu-04',
  kind: 'remote',
  exposesCapabilities: [
    'document:render.pdf@1',
    'invoice:extract@1',
  ],
  labels: {
    region: 'eu-west',
    dataLocality: 'customer-private',
    accelerator: 'gpu',
    trustTier: 'verified',
  },
  attestation: {
    identity: '<service-account-jwt>',
    version: 'v1.4.2',
    allowedEnvironments: ['org', 'project'],
  },
});
```

Three runner-side requirements:

1. **Identity** — every runner authenticates with a service-account token issued by the platform's identity provider.
2. **Attestation** — the runner declares its version, allowed environments (org-admin signed), and data-residency labels.
3. **Labels** — labels are how [Policy](./policy.md) `routeHints` match runners. A label is a free-form `key=value`; the policy compiler verifies that every label referenced in a policy is provided by at least one runner during install lint.

---

## Embedded runners — fast path

Embedded runners are not separate processes. They are modules loaded directly into the kernel server binary. Use them for:

- The Concept Registry, the Shell built-in commands, XVFS resolution, the meta-tools.
- Capabilities that are pure functions of in-memory state and would suffer a serialization round-trip otherwise.

The trade-off: embedded runners share the kernel server's lifecycle. A crash takes down the whole control plane. That is why third-party biomes are never embedded — only kernel-shipped surfaces are.

---

## Local-module runners — the developer default

A **local-module runner** is a separate process on the same node, supervised by `apps/biome-host-api`. This is the default for first-party biomes and for every biome installed by `xema dev`. The supervisor:

- Spawns the runner with a minimal environment (no `*_API_URL` env vars — the runner discovers everything via the Service Registry).
- Issues a service-account token at spawn time.
- Restarts on crash (with exponential backoff and a crash budget).
- Reaps zombies on biome uninstall.

Local-module runners may share the host machine's filesystem and network namespace. The [Environment](./environments.md) governs whether they may use it.

---

## Remote runners — push vs pull

A **remote runner** is a different machine entirely. There are two transport modes; the runner picks one at registration:

### Push mode (cluster default)

```
kernel-server  →  event-hub-api  →  remote runner subscribes
                      │
            xema.runner.dispatch.v1
```

The kernel server emits a `xema.runner.dispatch.v1` CloudEvent. The runner consumes from its subscription, executes, and emits `xema.runner.result.v1` back. This is the high-throughput, low-latency mode used inside a cluster.

### Pull mode (customer-edge default)

```
remote runner  →  long-polls  →  POST /runners/<id>/pull-work  →  kernel-server
```

The runner long-polls a kernel endpoint. This mode works through NAT, behind corporate firewalls, and across cloud boundaries without inbound connectivity. Customer-edge and regulated-on-prem deployments use pull mode by default.

Both modes share the same dispatch contract: the runner receives a signed `RunnerJob` containing the full `ExecutionContext`, the capability ref, the input, and an RS256-signed job token with a tight TTL (≤60s).

---

## Signed job tokens

Every dispatch carries a kernel-signed token bound to the specific invocation:

- Issuer: the kernel server.
- Subject: the invocation ID.
- Audience: the target runner identity.
- Scope: the single capability ref being invoked.
- TTL: ≤60 seconds.

The runner verifies signature, audience, scope, and freshness before touching the input. A token that does not match the job is rejected with `RUNNER_TOKEN_MISMATCH` — there is no second-chance retry on the same token.

Why this matters: a leaked job token is useless past 60 seconds, useless on a different runner, useless for a different capability. Compromise of one runner does not lateral-move across the cluster.

---

## Runner attestation lifecycle

A runner is **not** trusted until it is attested. The kernel server records:

| Property | Source |
|---|---|
| Identity | Service-account JWT from the identity provider |
| Version | The runner reports it at register; cross-checked against the version manifest |
| Allowed environments | Signed by the org admin during onboarding |
| Data-residency labels | Signed by the org admin during onboarding |
| Trust tier | `first-party` / `verified` / `community` / `untrusted` |

A runner whose attestation expires or fails verification is removed from the dispatch pool immediately; in-flight jobs are allowed to complete (with a deadline) and no new jobs are dispatched.

---

## Picking a runner — the matching algorithm

When the router has a `PolicyDecision` with `routeHints` and a capability ref:

1. Filter runners to those that expose the capability.
2. Apply `requiredRunnerKind` if set.
3. Filter to runners whose `labels` cover every `requiredLabels` entry.
4. Filter to runners in `requiredRegion` if set.
5. Filter to runners matching `requiredResidency` if set.
6. Remove any runner in `excludeRunners`.
7. Pick the lowest-loaded survivor.

If the filter set is empty after step 6, the invocation fails fast with `NO_RUNNER_MATCHES_POLICY`. There is no fallback to a less-restrictive runner — a regulated workload never silently spills onto a cloud runner.

---

## Related concepts

- [Policy](./policy.md) — `routeHints` are the input to runner selection.
- [Service registry](./service-registry.md) — how runners advertise themselves.
- [Execution contexts](./execution-contexts.md) — what the dispatch payload carries.
- [Environments](./environments.md) — runner allowed-environment lists are the trust gate.
- [Capabilities](./capabilities.md) — every capability is served by one or more runners.

---

**Previous**: [← Policy](./policy.md)
**Next**: [Service Registry →](./service-registry.md)
