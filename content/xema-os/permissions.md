# Permissions & Access

**Permissions** in Xema OS answer one question for every action a person, an agent, a workflow, or an app takes: *may this subject do this, here, now?* There is one model and one decision point — no second permission system to keep in sync. The default is effortless (an agent can do what its owner can do, nothing more); the ceiling is yours to raise, capability by capability, when governance calls for it.

This page is the map. It ties together the pieces documented in depth elsewhere — [Capabilities](./capabilities.md), [Policy](./policy.md), [Environments](./environments.md), [Profiles](./profiles.md), [Spaces](./spaces.md) — and adds the agent **reach-tier** model that sits on top of them.

---

## The building blocks

Five concepts compose the whole system. Only the first four are ever named in the UI; the fifth is plumbing.

| Concept | What it is |
|---|---|
| **Capability** | One specific action, named by a ref (e.g. `kb:page.read@1`). The atom of permission — see [Capabilities](./capabilities.md). |
| **Grant** | "This subject may use this capability, in this environment." The one thing the verdict checks. |
| **Role** | A reusable *bundle* of grants. A **[Profile](./profiles.md)** is a ready-made, named role. |
| **Team** | A group of subjects, with nesting. Assign a role to a team → every member (and sub-team) inherits it. |
| **Environment** | *Where* a call runs — `session`, `org`, `sandbox`, `public`, … A grant is scoped to one. See [Environments](./environments.md). |

A **subject** is whoever acts: a user, an agent, a service, a team/role (as a carrier), an app, a runner, or an external/anonymous caller. Every request carries a token the platform resolves into a request context (who, which org, what kind of token).

---

## One decision, every call

Every action routes through a single policy decision (the PDP). It composes the verdict in a fixed order, then returns `allow` / `deny` / `needs_approval` — fail-closed. Full contract on the [Policy](./policy.md) page; the ordered checks are:

```
1. Grant       — does the subject hold the capability? (relation lookup)
2. Delegation  — an agent acting for a user can't exceed that user (intersection)
3. Reach tier  — apply the acting agent's ceiling (see below)
4. Resource    — for a specific instance, may the subject see/own it?
5. Credential  — bind the right external credential for the call
```

The same decision governs a human clicking a button, an agent calling a tool, a scheduled workflow, and an embedded app. Decisions are cached per `(subject, capability, space, environment)` and invalidated by events when grants or environments change.

---

## Where permissions come from

A subject's initial access is never hand-assembled. It comes from exactly three places:

| Source | What it provides |
|---|---|
| **Boot seeds** | Public, login-free reads (so help and discovery work unauthenticated) + the in-the-box service grants the platform needs to function. |
| **Org-role sync** | On membership change or login, the org's owner / admin / member roles are materialised and assigned — a new member is usable immediately. |
| **Declared by the thing** | A tool, skill, or agent declares the capabilities it needs; the platform provisions them under policy (see [Arming is permission](#arming-is-permission)). |

This is the same 5-tier ownership/scope model used across the platform — **User > Project > Org > Biome > System**, most-specific wins. Re-scoping (promote to org, move to a team) *is* the "share it" action; there is no separate binding subsystem.

---

## Agent reach tiers

An agent's actual power is always the intersection of three things:

> **effective access = armed tools/skills  ∩  reach tier  ∩  owner authority**

The **reach tier** is the only knob a user picks — a ceiling on how far the agent may reach. `AgentReachTier` is a closed set; each tier is a superset of the previous, and the default needs no configuration:

| Tier | Meaning |
|---|---|
| `sandbox` | Runs only in the sandbox environment. Touches nothing real — for testing an agent before you trust it. |
| `as-owner` *(default)* | The agent's authority equals its owner's. "You, automated" — inherently safe, since it can never exceed you. |
| `connected` | `as-owner` plus the org's connected integrations (source control, knowledge, trackers) — but not platform control. |
| `full` | Unrestricted within the org, including platform control. Reaching this far is admin-gated. |

Because the ceiling is intersected with the owner's authority, a low-privilege owner's agents are automatically low-privilege. An interactive agent is authorized as its owner (`user:<owner>`); an autonomous agent is authorized as its own stable identity (`agent:<slug>`), so the permissions provisioned for *it* apply.

Special abilities — "can build agents", "can manage permissions" — are **plain capabilities toggled on top of a tier**, never their own tier or profile. This is the rule that keeps the tier list short.

---

## Arming is permission

Equipping an agent with a tool or skill *is* the permission declaration — there is no separate policy to author. When an agent is saved, Xema derives the capabilities its armed tools, skills, and abilities need (its **manifest**) and provisions grants for the agent under one rule:

- **Auto-grant** — low/medium-risk capabilities the owner already holds. Zero clicks.
- **One-click approve** — high/critical-risk, approval-required, or anything beyond the owner's own authority → surfaced as a review, written as a pending grant until approved.
- **Request access** — a capability the org itself doesn't hold → an explicit ask.

With the default `as-owner` tier, arming an agent with a tool you can already use is fully automatic — the common case has no setup at all.

---

## Group policy: roles + teams

To set policy once for many subjects, assign a **role** (a grant bundle) to a **[team](./policy.md)**. Every member — people *and* their agents — inherits it, and nested sub-teams roll up automatically. Add someone to the team and they're covered; remove them and access is revoked. Teams are optional and additive: an agent works with no team at all, so there is no "create a team before you can start" step.

This is the answer to "don't make me grant capability-by-capability": define the role once, hand it to a group.

---

## Effortless, then powerful

The same primitives serve every level — you only meet the depth you ask for.

| Level | Experience |
|---|---|
| **Beginner** | Create an agent → it's `as-owner` → arm it with tools → done. Never sees a capability name. |
| **Org admin** | Pick a higher tier, set the org's default tier, or assign a role to a team to set policy once. |
| **Security / large org** | Author custom roles from individual capabilities, deny a capability on one sub-agent, add rate/cost constraints, scope to environments. Same objects, more knobs. |

---

## Safe by default

The model is least-privilege by construction and auditable end to end:

- **Owner-bounded** — an agent never exceeds the person behind it.
- **Tenant-isolated** — access granted in one org never leaks into another; every decision is org-aware.
- **Human approvals** — sensitive or destructive calls pause for a named approver; the run is durable across the wait.
- **Private stays private** — personal data can be *owner-only*: an org admin may hold the action but not a specific user's instance (e.g. a personal mailbox). Resource ownership is enforced at the verdict, not bolted on.
- **Fully audited** — every allow, deny, and approval carries a structured, queryable reason.

Tightening controls roll out **safely**: tenant-isolated verdicts, the delegation clamp, and arming-based auto-provisioning each activate per environment after verification, and default to *no behavior change* until an org turns them on. Nothing flips silently.

---

## Related concepts

- [Capabilities](./capabilities.md) — the invocation surface every grant names.
- [Policy](./policy.md) — the full decision shape, obligations, route hints, and approval flow.
- [Environments](./environments.md) — the trust zones a grant is scoped to.
- [Profiles](./profiles.md) — named, reusable grant bundles attached to subjects.
- [Agent Composition](./agent-composition/) — the agent + sub-agent tree a reach tier governs.
- [Spaces](./spaces.md) — where data lives and the classification that flows into the verdict.

---

**Previous**: [← Policy](./policy.md)
**Next**: [Profiles →](./profiles.md)
