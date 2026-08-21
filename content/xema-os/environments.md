# Execution Environments

An **execution environment** is a named runtime profile that describes *where* a capability is permitted to run. Every capability call in Xema OS is bound to exactly one environment. Environments encode trust boundaries, data-residency constraints, network reachability, and which capabilities are reachable from within them.

An execution environment is the canonical, unambiguous term for the trust profile that gates every capability invocation. It is intentionally distinct from cloud availability regions, DNS terms, and Kubernetes node-grouping labels.

---

## The eight built-in environments

| Environment | Trust level | Who typically runs in it | Network access |
|---|---|---|---|
| `system` | Kernel-trusted | Xema platform internals only | Full internal |
| `org` | Org-trusted | Org-installed biomes; org admins | Org-scoped external via connectors |
| `project` | Project-scoped | Project-installed biomes; project members | Project-scoped external via connectors |
| `app` | App-scoped | External-facing apps with delegated sessions | AudiencePolicy-mediated |
| `session` | Session-scoped | Active interactive sessions | Inherits from the session's environment at launch |
| `sandbox` | Isolated | Biomes under development or first install | No external network; no org secrets |
| `store-review` | Store-isolated | Biomes under Store review | Sandboxed; no real org data |
| `public-app` | Public-facing | External subjects on a published app | Highly restricted; audience-policy-mediated |

The set is closed (`ExecutionEnvironmentKind` enum in `@xemahq/execution-environment-contracts`). Third-party biomes cannot introduce new built-in environments. Orgs may, however, **author custom environments** that compose the built-in policy templates (see [Custom environments](#custom-environments-org-defined)).

---

## Environment enforcement

Environment enforcement is two-part:

1. **At install time** — the install grant records which environments the biome is permitted to operate in. The org admin sets this during approval.
2. **At runtime** — the capability router checks that the active environment is in the grant's allowed set before dispatching. A mismatch returns a structured denial with an `auditId`.

Every invocation carries an [ExecutionContext](./execution-contexts.md) that includes the environment. The environment cannot be forged by the caller — it is resolved from the active session context.

---

## Environment grants

A **grant** records that a specific subject (biome, agent, user, app client) may invoke a specific capability within a specific environment. Grants are created when an install grant is approved and when an org admin explicitly grants additional access.

Inspect active grants:

```bash
xema environment explain --subject biome:acme-code-review --environment org
```

This prints the full grant tree: which capabilities the subject holds, in which environments, expiry (if any), and rate limits.

---

## Sandbox environment — development and testing

The `sandbox` environment is the default for biomes in `draft` and `sandbox-installed` states. It enforces:

- **No org secrets**: connector credentials, API keys, and encrypted config are not injected.
- **No external network**: outbound calls are blocked except to declared mock connectors.
- **No writes to org storage**: knowledge-base writes, artifact emissions, and storage-schema mutations are redirected to an ephemeral test namespace.
- **Real terminal**: the sandbox provides a real Linux PTY for shell commands. Commands that would require org grants are denied.

Use the sandbox to iterate fast without risk to production data. Graduate to `org` or `project` only after the biome passes review.

---

## Environment-aware commands

The Xema Shell lets you inspect environments directly:

| Command | What it shows |
|---|---|
| `xema environments list` | All environments available to the calling subject |
| `xema environment explain <env>` | Capabilities available in the environment, grants, limits |
| `xema why-denied <auditId>` | Full denial reason, which environment was active, suggested fix |

---

## Custom environments (org-defined)

Orgs may compose custom environments rooted under their org [Space](./spaces.md). A custom environment is a named profile that:

- Inherits one or more built-in policy templates (e.g. `org-baseline`, `data-residency-eu`).
- May tighten — never weaken — the capability set, data-classification floor, or runner selection of its parent template.
- Is scoped to the org Space and its descendants; it cannot leak into other orgs.

Example: an org-defined `finance-production` environment denies `connector:bank.transfer@1` from any caller while allowing `connector:erp.create-invoice-draft@1`. The custom environment is just data — no code change; admins compose it through the Org Settings UI or via `xema environment create`.

---

## Org admin: assigning environments

When installing a biome, the org admin picks the environments it may operate in. To change after install:

1. Open **Org Settings → Biomes → [biome name] → Edit Grant**.
2. Adjust the environment set and confirm.
3. The updated grant takes effect on the next capability call (no restart required).

Changes are audited. The previous grant version is retained for compliance review.

---

## Related concepts

- [Spaces](./spaces.md) — the *where* of data ownership; environments are the *where* of runtime trust.
- [Execution contexts](./execution-contexts.md) — the per-invocation envelope that carries the active environment.
- [Policy](./policy.md) — the decision protocol that consults the environment.
- [Runners](./runners.md) — runner labels match `routeHints` derived from environment policy.
- [Capabilities](./capabilities.md) — every invocation binds to one environment.

---

**Previous**: [← Capabilities](./capabilities.md)
**Next**: [Spaces →](./spaces.md)

