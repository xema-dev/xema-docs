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

## Execution targets

A runner kind says *what sort of executor* runs the work. An **execution target**
says *which pool of executors picks it up* — and that is a different question, with
a different owner. A target is the unit a customer points at when they say "this
workload runs on our hardware, in our region."

A target carries a slug, an owning Space, an operational label map, and the ceilings
that apply to everything running on it:

| Field | What it decides |
|---|---|
| `slug` | The pool's name. Lowercase, digits and `-`, up to 63 characters |
| `ownerSpaceUri` | Who owns it — `xema://system` or `xema://orgs/<orgId>` |
| `labels` | Operator declarations about the pool (see below) |
| `status` | `provisioning`, `active`, `draining`, `revoked`, `failed` — only `active` accepts new work |
| `minTrustTier` / `maxTrustTier` | The trust band anything placed here must fall inside |
| `isolation` | The runtime isolation the pool provides |
| `maxDataClassification` | The classification ceiling for work placed here. Absent means *un-configured* — never a defaulted `public` |
| `isDefault` | The org's fallback when nothing more specific is declared |

The platform operates one shared pool, `xema-managed`, which every organization falls
back to until it declares one of its own.

### Owned by a Space, so ownership comes for free

A target is owned at a Space, and the tiers it admits are exactly two: `system` and
`org`. That is an [admissible subset](./spaces.md) of the one ownership vocabulary,
not a private enum, so everything the ownership plane already knows how to do applies
unchanged — precedence between two targets at one slug is the same rank map, and
re-scoping is the same promotion rule.

The omissions are decisions. A target is a *physical* pool with an enrolled worker
behind it, so `project`, `user` and `session` are refused: a pool nobody can enrol
into is a promise the platform cannot keep, and narrowing *within* an org's target is
what a per-installation label requirement already does. `biome` and `app` are refused
for a different reason — a biome declares what it **needs** from a runtime and is
forbidden from naming **where** it runs.

### Labels — an open map with three keys that have a reader

An operator may advertise anything on a target. Three keys are read by the platform:

| Key | Means |
|---|---|
| `region` | Where the pool physically is |
| `residency` | The data-residency claim the pool satisfies |
| `accelerator` | The accelerator class available on it |

`residency` is the one that closes a long-standing hole. A residency used to be
expressible only as a [policy](./policy.md) obligation naming a region, with nothing
on the other side able to satisfy it. Declared on a target, the claim is enforceable
for a structural reason rather than a string-comparison one: the target has its own
task queue, polled by the operator's own worker, on the operator's own hardware.

Keys and values are both open vocabularies with one closed property — they are
DNS-label-shaped, so `eu`, `eu-central-1` and `a100` are legal and `EU WEST!` is
not. A label the platform cannot represent is **refused**, never coerced or dropped:
silently discarding one would place work somewhere the operator did not ask for while
reporting success.

### One task queue per target, by construction

Placement is not a lookup table bolted onto dispatch — it is the queue name itself:

```
<targetSlug>::<functional>

xema-managed::xema_default
acme-gpu-frankfurt::xema_agent
```

The functional half says what *kind* of capacity a poller is equipped for —
`xema_default`, `xema_agent`, `xema_human` — and none of the three says where. The
target slug is the dimension that does.

The grammar has exactly one implementation, in the kernel, and both directions of it
(compose and parse) live there. Every queue is qualified, including the platform's
own — there is no unqualified default that work can fall into by accident. The slug
pattern is deliberately narrower than a Space segment id for this reason: a slug is
embedded verbatim in a queue name, so it must not contain the separator the grammar
splits on.

A worker is configured with the target it polls for, and polls only that target's
queues. Work placed on a target an org operates therefore never executes anywhere
else — not because a filter excluded the alternatives, but because nothing else is
listening.

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
- [Spaces](./spaces.md) — an execution target is owned at a Space, which is where its precedence and re-scoping come from.
- [Service registry](./service-registry.md) — how services discover each other.
- [Execution contexts](./execution-contexts.md) — what the dispatch payload carries.
- [Environments](./environments.md) — an enrollment's allowed-environment list is the trust gate.
- [Capabilities](./capabilities.md) — every capability is served by one or more runners.

---

**Previous**: [← Profiles](./profiles.md)
**Next**: [Service Registry →](./service-registry.md)
