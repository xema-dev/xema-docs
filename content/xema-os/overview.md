# Overview

**Xema OS** is the system layer that lets humans, agents, workflows, and external apps share one substrate of typed objects, capability-mediated invocations, and installable software bundles called **biomes**. It is the operating-system framing of the existing Xema platform — same primitives, made explicit and addressable.

---

## Who Xema OS is for

- **Org admins** deciding which biomes to install, what each one is allowed to do, and how external audiences reach the org.
- **Biome authors** packaging domain capabilities — agents, skills, workflows, connectors, document templates, UI surfaces — without reaching into other biomes or platform internals.
- **Integrators** embedding Xema into their own customer-facing products through delegated identities and scoped capability grants.
- **Agents** that need a stable, self-describing surface to discover what exists, what they may invoke, and why a call was denied.

---

## The four primitives + Agent Composition

Agent capability in Xema is built from exactly four primitives:

- **Skill** — a folder bundle that teaches an agent how to do something.
- **Tool** — an executable capability (MCP-exposed or kernel-built-in) an agent can call.
- **Model** — an LLM provider/model pair, resolved per-invocation by the Model Resolution Matrix.
- **Agent** — an agent definition (identity, prompt, intrinsic skills, intrinsic tools).

**Agent Composition** wires them together: an agent armed with skills and tools whose sub-agents are themselves fully-armed composition nodes. The same composition is usable as both an interactive-session agent and a workflow step.

Xema OS does not add a fifth primitive. The Object Model, Capability Protocol, and the biome package format are the substrate over which the four primitives compose.

---

## The four-concept runtime model

Every capability call in Xema OS is described by exactly four concepts working together:

- **[Space](./spaces.md)** — *where* the data lives and *who* owns it (a hierarchical URI from `System` down to `User`, with a data-classification floor).
- **[Execution Environment](./environments.md)** — *which trust profile* applies to this call (`system`, `org`, `project`, `app`, `session`, `sandbox`, `store-review`, `public-app`).
- **[Execution Context](./execution-contexts.md)** — the per-invocation envelope binding subject, Space, Environment, capability, and input.
- **[Policy](./policy.md)** — the decision protocol that turns an Execution Context into `allow` / `deny` / `needs_approval` plus obligations and route hints.

> A Subject invokes a Capability exposed by a Biome, against an object in a Space, from an Execution Environment, executed by a Runner, when Policy allows it.

---

## The six layers

Each layer has one responsibility and one direction of dependency (downward only).

| Layer | Owns |
|---|---|
| **6 — Experience / Surface** | Xema Web, embedded widgets, customer portals, the Shell UI, the OS Console |
| **5 — Audience** | App Clients, External Subjects, Delegated Sessions — the boundary between Xema users and "customers of a customer" |
| **4 — Apps** | An App = one or more installed biomes configured for an audience with branding, capability policy, and a version lockfile |
| **3 — Biomes** | Installable software bundles: agents, skills, workflows, connectors, document templates, FE/BE contributions, optional services |
| **2 — Platform Services** | The in-the-box services every sub-app needs (workflow engine, artifact store, knowledge base, biome host, the new object registry, capability gateway, authorization, shell, store) |
| **1 — Kernel** | Pure contracts and SDKs — the Xema System Interface (XSI). Zero domain knowledge |
| **0 — Infrastructure** | Managed database, Redis, object store, Kubernetes, LLM providers — not ours to design |

---

## The Xema System Interface (XSI)

XSI is the stable external interface every biome, app, agent, workflow, and external surface speaks. One protocol, five planes:

1. **[Object Model](./objects.md)** — the typed universe of things Xema knows about (`XemaObject`, `XemaObjectKind`), each anchored to a [Space](./spaces.md).
2. **[Contribution Protocol](./sdk/contributions.md)** — how new objects and behaviors enter the OS (kernel-typed envelope, closed `ContributionKind` enum, backend slot registry).
3. **[Capability Protocol](./capabilities.md)** — how those objects are invoked. Every call carries an [Execution Context](./execution-contexts.md) and routes through the capability router.
4. **[Execution Environment Protocol](./environments.md)** — which trust profile applies to a call. Eight built-in environments: `system`, `org`, `project`, `app`, `session`, `sandbox`, `store-review`, `public-app`.
5. **Manifest / Wire** — how all of the above are declared in the biome manifest and routed through `subscribes[]`, `requires`, `contributions`, `requiresCapabilities[]`, `exposesCapabilities[]`.

---

## The eight primitives

Every concept the runtime mediates falls into one of eight primitives:

1. **Subject** — who is calling (user, agent, app client, external subject, service, runner).
2. **Capability** — what is being invoked (`<domain>:<resource>.<verb>@<major>`).
3. **Biome** — the installable bundle exposing the capability.
4. **Object** — the typed thing the capability touches (`XemaObject`).
5. **[Space](./spaces.md)** — where the object lives and who owns it.
6. **[Execution Environment](./environments.md)** — what trust profile the call runs under.
7. **Runner** — where the implementation actually executes (embedded / local-module / remote).
8. **[Policy](./policy.md)** — the decision protocol that mediates everything above.

Plus the per-invocation envelope that wires them together: **[Execution Context](./execution-contexts.md)**.

---

## Deployment profiles

Xema OS deploys in three shapes from the same codebase. There is no fork between dev and production — the same primitives, same contracts, the same `xema` CLI.

| Profile | Use case | KernelState | Service data DB | Cache | Event substrate | Identity |
|---|---|---|---|---|---|---|
| `dev` | Single developer, `xema dev` single binary | SQLite (in-process) | SQLite (per-service file) | in-memory | in-process event hub | stub OIDC |
| `single-instance` | Small org self-hosting on one VM | SQLite (file at `/var/lib/xema/kernel-state.sqlite`) | Postgres | Redis | event hub | Keycloak |
| `cluster` | Production multi-node | etcd cluster | Postgres | Redis | event hub | Keycloak |
| `managed-cloud` | Hosted Xema, multi-tenant | etcd cluster | Postgres (multi-tenant) | Redis | event hub | Keycloak federated |

Three deployment shapes, one codebase. Capability calls produce identical `PolicyDecision` outputs across all four profiles for the same `ExecutionContext`.

---

## Where to go next

- **[Objects](./objects.md)** — how Xema represents every addressable thing as a typed `XemaObject`.
- **[Capabilities](./capabilities.md)** — the invocation plane every biome calls through.
- **[SDK / Getting Started](./sdk/getting-started.md)** — author your first biome manifest.
- **[SDK / Manifest](./sdk/manifest.md)** — the full manifest reference, including the Phase 1A additive fields.

---

**Next**: [Objects →](./objects.md)
