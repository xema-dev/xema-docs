# Execution Environments

An **execution environment** is a named runtime profile that describes *where* a capability is permitted to run. Every capability call in Xema OS is bound to exactly one environment. Environments encode trust boundaries, a data-classification ceiling, and how far outside itself a capability may reach from within them.

An execution environment is the canonical, unambiguous term for the trust profile that gates every capability invocation. It is intentionally distinct from cloud availability regions, DNS terms, and Kubernetes node-grouping labels.

---

## The nine built-in environments

| Environment | Trust level | Who typically runs in it | Reach ceiling |
|---|---|---|---|
| `system` | Kernel-trusted | Platform operators, migrations | `platform` — unconstrained |
| `org` | Org-trusted | Org admins; biome install / uninstall | `platform` — unconstrained |
| `project` | Project-scoped | Project members; the default agent and workflow runtime | `integration` |
| `app` | App-scoped | Apps configured for an audience | `integration` |
| `session` | Session-scoped | Interactive sessions, bounded by user permissions | `integration` |
| `sandbox` | Isolated | Biomes an org is evaluating; biome build/test | `owner` |
| `public` | Public-facing | External delegated sessions — chat widgets, customer portals | `owner` |
| `store-review` | Store-isolated | A biome inspected for publication; no real org data | `owner` |
| `trusted-dev` | Local-dev escape hatch | Biome authors on their own machine | `platform` — unconstrained |

The set is closed: `ExecutionEnvironmentKind` in `@xemahq/kernel-contracts`. Third-party biomes cannot introduce new built-in environments. Slugs are stable wire identifiers — they appear in `ExecutionEnvironmentRef` (`environment:<slug>`), in capability grants, and in audit rows.

`trusted-dev` is not a production environment. Inside it the capability gateway grants every capability the biome *declared* in its manifest — no resource glob, no rate limit, no human approval — precisely so an author can see what their biome would do. Every call is still audited, and the environment is never reachable from production data.

---

## The reach ceiling — how a built-in environment is actually constrained

The environment's half of the permission plane is a **reach ceiling**: the maximum [`CapabilityReach`](./capabilities.md) (`owner` | `integration` | `platform`) a capability may declare and still be invocable here.

Two properties matter:

- **It is a restriction, never a grant.** The ceiling is intersected with the grant verdict, never unioned. An environment that admits `platform` reach grants nobody anything — it merely declines to narrow.
- **It cannot go stale.** Capabilities are an open set that biomes contribute to at install time. A ceiling is expressed over a closed vocabulary every capability descriptor already carries, so a capability contributed tomorrow is classified the moment it declares its reach. No environment needs editing.

When the capability catalogue cannot answer, the two families behave differently, and deliberately so:

| Enforcement | Environments | Unresolvable capability |
|---|---|---|
| `boundary` — the environment *is* the control | `sandbox`, `public`, `store-review` | **DENY** |
| `refinement` — the environment narrows an already-granted call | `system`, `org`, `project`, `app`, `session`, `trusted-dev` | Defer to the grant verdict, and say so in the log |

One global policy would force a choice between "a registry blip denies every session" and "sandbox is bypassable by making the registry unavailable". Those are not the same question, so they do not share an answer.

---

## The data-classification ceiling

Every environment carries `maxDataClassification` — the most restrictive [`DataClassification`](./spaces.md) (`public` | `internal` | `confidential` | `secret` | `regulated`) an invocation may carry and still run there. The column is NOT NULL with a declared permissive default (`regulated`, i.e. everything admitted); a nullable column would read as "unconfigured" while possibly enforcing something.

An organization may tighten a **built-in** environment's classification ceiling for itself without editing the built-in: an `ExecutionEnvironmentCeilingOverride` row caps one built-in slug for one org.

---

## Environment enforcement

Environment enforcement is two-part:

1. **At install time** — the install grant records which environments the biome is permitted to operate in. The org admin sets this during approval.
2. **At runtime** — the capability router checks that the active environment is in the grant's allowed set before dispatching. A mismatch returns a structured denial.

Every invocation carries an [ExecutionContext](./execution-contexts.md) that includes the environment. The environment cannot be forged by the caller — it is resolved from the active session context.

---

## Environment grants

A **grant** records that a specific subject (biome, agent, user, app client) may invoke a specific capability within a specific environment. Grants are created when an install grant is approved and when an org admin explicitly grants additional access.

Grants are managed from **Org Settings → Authorization**, and through the platform API. See [Permissions & Access](./permissions.md) for the whole grant model.

---

## Sandbox environment — development and testing

The `sandbox` environment is where an org evaluates a biome it does not yet trust. Its reach ceiling is `owner` — nothing beyond what the invoking subject already holds — and that ceiling is a `boundary`: if the catalogue cannot classify a capability, the call is denied rather than admitted.

Practically, that means no production credential access. The environment *is* the boundary; there is no second list to keep current.

---

## Custom environments (org-defined)

An organization may author its own environments, rooted under its org [Space](./spaces.md). A custom environment is a row like any other, distinguished by `isBuiltIn = false` and an owning `orgId`. It is scoped to that org; it cannot leak into another.

A custom environment is also the **only** place a per-ref `allowedCapabilities` allow-list is meaningful: the org names exact refs, the list is small, and the org owns its staleness. A built-in may never carry one — that is a database CHECK constraint (`execution_environments_builtin_no_capability_allow_list`), not a convention.

The reason is worth stating, because it is the same mistake twice avoided. The nine built-ins ship the list empty. A consumer gating on it must read empty as deny-all — a total outage, which shipped once — or ignore it, which makes the control inert for the environments nearly every org uses. Neither is a control. The reach ceiling is.

---

## Related concepts

- [Spaces](./spaces.md) — the *where* of data ownership; environments are the *where* of runtime trust.
- [Execution contexts](./execution-contexts.md) — the per-invocation envelope that carries the active environment.
- [Policy](./policy.md) — the decision protocol that consults the environment.
- [Runners](./runners.md) — where a capability's implementation actually executes.
- [Capabilities](./capabilities.md) — every invocation binds to one environment, and declares one reach.

---

**Previous**: [← Capabilities](./capabilities.md)
**Next**: [Spaces →](./spaces.md)
