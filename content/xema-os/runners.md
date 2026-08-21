# Runners

A **runner** is the process that actually executes a capability. The Xema OS control plane (router, authorization, audit) is uniform across deployments; the runner layer is where *physical execution* happens — on a cloud node, on a GPU node, on a customer-edge VM, in a sandbox, or bridged out to an external MCP server. The choice is data-driven, not hard-coded.

The runner abstraction makes it possible to deploy the same biome to a developer's laptop, a small org's single VM, and a regulated multi-region cluster without changing a line of biome code.

---

## The runner kinds

`RunnerKind` is a closed enum. It lives in the **policy** surface of `@xemahq/kernel-contracts` — the decision layer is its primary author, because policy selects on it to route an invocation — and the runner surface re-exports it so there is no second declaration to drift against.

| Kind | Wire value | Typical use |
|---|---|---|
| `Local` | `local` | Same-node execution supervised by the biome host |
| `Cloud` | `cloud` | The default in-cluster pool |
| `CustomerEdge` | `customer-edge` | A machine the customer operates, in their own network |
| `GPU` | `gpu` | Accelerator-backed workloads |
| `Sandbox` | `sandbox` | Biome build/test and untrusted evaluation |
| `CI` | `ci` | Continuous-integration executors |
| `McpExternal` | `mcp-external` | An external MCP server, bridged through `mcp-gateway-api` |

A capability is not pinned to a runner kind at registration. [Policy](./policy.md) chooses — softly via `routeHints.preferredRunnerKind`, or hard via a `require-runner-kind` obligation — and the router then picks a specific runner instance that matches.

`McpExternal` is worth calling out: the router resolves capability refs of the form `<provider-slug>:<tool-name>@1` to that kind and forwards the invoke envelope to the external bridge, which translates it into an MCP `tools/call` against the originating org-registered MCP server. An external MCP tool is a runner, not a special case.

---

## Enrollment — the ceiling is set before the runner ever speaks

A runner does not describe itself into existence. It is **enrolled** first, by an org admin, and the enrollment records the ceilings the runner may later attest within:

| Enrollment field | What it caps |
|---|---|
| `allowedKinds` | Which `RunnerKind` values this runner may attest as |
| `maxTrustTier` | The highest trust tier it may claim (`untrusted` < `verified` < `trusted` < `system`) |
| `allowedLocalities` | Which data localities it may claim (`cloud`, `customer-private`, `gpu`) |
| `allowedEnvironmentIds` | Which [execution environments](./environments.md) it may run in |

`allowedKinds` is NOT NULL and refused **empty** at create. That is deliberate: an empty allow-list is a deny-all ceiling that reads as "unconfigured", and that shape has already caused a total outage elsewhere in the platform. A declarative enrollment configuration that omits the field fails to parse at boot, loudly, rather than starting with a silently permissive or silently empty ceiling.

---

## Attestation — the runner's claims are checked against its enrollment

At attestation the runner asserts its kind, trust tier, locality and environments. All four are compared against the enrollment in one expression, inside the same transaction that records the attestation:

- the asserted trust tier must not out-rank `maxTrustTier`;
- the asserted locality must be in `allowedLocalities`;
- the asserted kind must be in `allowedKinds`;
- every asserted environment must be in `allowedEnvironmentIds`.

Any of them exceeding its ceiling is refused — the attestation does not partially succeed. The kernel applies the same kind check again before it signs a lease, so a runner cannot obtain a signed lease naming a kind its enrollment never authorized.

This matters because the runner's kind arrives from the runner's own configuration. Self-asserted and uncapped, it would be a routing decision made by the thing being routed to: a runner could declare itself `customer-edge` and become the target of every invocation pinned to customer-edge residency. The enrollment ceiling is what makes the self-assertion safe.

A runner whose attestation expires or fails verification is removed from the dispatch pool. In-flight jobs follow the enrollment's declared in-flight policy; no new jobs are dispatched.

---

## Transport — push and pull

`RunnerTransport` is a two-member enum: `push` and `pull`. The runner's transport is part of its registration, not a per-invocation choice.

### Push (cluster default)

The kernel dispatches to the runner. High-throughput and low-latency, and it assumes the runner is reachable — which is true inside a cluster and false almost everywhere else.

### Pull (customer-edge default)

The runner reaches **outbound** and takes work. This works through NAT, behind corporate firewalls, and across cloud boundaries with no inbound connectivity at all. Customer-edge and regulated on-premise deployments use it by default.

Both modes share the same dispatch contract: the runner receives the full execution context, the capability ref, the input, and a short-lived signed job token.

---

## Signed job tokens

Every dispatch carries a kernel-signed token bound to that specific invocation — issuer, subject, audience (the target runner identity), the single capability ref in scope, and a tight expiry. The runner verifies signature, audience, scope and freshness before touching the input.

A leaked job token is useless past its expiry, useless on a different runner, and useless for a different capability. Compromise of one runner does not laterally move across the cluster.

---

## Picking a runner — the matching algorithm

Given a `PolicyDecision` and a capability ref, the selector applies **hard filters in order**, recording how many candidates survived each step:

1. **Binding and lease authority, exact match** — runner id, enrollment id, principal id, credential revision, attestation revision, runtime id, owning org and locality must all agree. Nothing that fails this is a candidate at all.
2. `requiredRunnerKind`, from a `require-runner-kind` obligation.
3. `requiredDataResidency`, from a `data-residency` obligation.
4. `requireCustomerEdge`, from the route hint.
5. `requiredRunnerLabels` — every key must match (AND semantics).
6. `requiredRegion` — matched against the runner lease's `region` operational label.

Then the soft preference `preferredRunnerKind` is applied if any candidate satisfies it, and the tie is broken deterministically.

If the candidate set empties, the selection returns which constraint eliminated the last survivor, and the invocation fails with `NO_RUNNER_AVAILABLE` naming it. There is no fallback to a less-restrictive runner — a regulated workload never silently spills onto a cloud runner.

Note what step 1 means in practice: labels, region and residency are **narrowing filters over already-authorized candidates**. A label never establishes ownership, trust, locality or capability authority. Authority comes from the enrollment and the lease; the filters only subtract.

---

## Related concepts

- [Policy](./policy.md) — obligations and route hints are the input to runner selection.
- [Service registry](./service-registry.md) — how services discover each other.
- [Execution contexts](./execution-contexts.md) — what the dispatch payload carries.
- [Environments](./environments.md) — an enrollment's allowed-environment list is the trust gate.
- [Capabilities](./capabilities.md) — every capability is served by one or more runners.

---

**Previous**: [← Profiles](./profiles.md)
**Next**: [Service Registry →](./service-registry.md)
