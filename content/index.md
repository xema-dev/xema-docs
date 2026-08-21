# Xema

> API Docs: https://docs-api.xema.dev/api/docs

**Xema is an operating system for organizations that run on AI.**

Not a framework, not a chat wrapper. An operating system in the specific sense that matters: it owns the things every application on top of it would otherwise have to build for itself, and it owns them once, so a team building on Xema can ignore them and still be correct.

[xema.dev](https://xema.dev)

---

## What an operating system owes its applications

Five duties. If a platform makes you re-implement any of them, you are integrating with it, not building on it.

| Duty | The question | What Xema owns |
|---|---|---|
| **Identity** | Who is acting, and on whose behalf? | People, agents, services, and an app's own external end users — one subject model, one delegation chain |
| **Naming** | What is this thing called, and who owns it? | One address, `xema://…`, for every ownable thing in the system |
| **Permission** | May this subject do this, here, now? | One decision point, consulted by every surface — UI, agent, workflow, embedded app |
| **Placement** | Where does this actually run? | Runners, enrolled and attested, from a shared cloud pool to a customer's own machine |
| **Lifecycle** | What happens over time — versions, revocation, records? | Draft/published state, signed and rotating keys, and an audit journal |

Everything else in this documentation is one of those five, made concrete.

---

## Three laws the platform holds itself to

These are not marketing. They are properties enforced by types, database constraints, and boundary checks, and they are the reason the model composes instead of accumulating exceptions.

### 1. One address

Every ownable thing is named by a `SpaceRef` — a `xema://` URI with a declared owner tier. `SpaceKind` is a closed set of seven: `system`, `org`, `project`, `app`, `session`, `biome`, `user`.

There is exactly one ownership vocabulary. Before August 2026 there were nine, and the cost was not untidiness — with a private vocabulary per subsystem, there is no address a "publish this to my organization" operation could name, so re-scoping something you own could not exist. It exists now because the address does.

### 2. Narrowing composes, and only in one direction

Every ceiling in Xema is a **join** that may raise restriction and never lower it. An environment's reach ceiling, a data classification, a capability's reach, an authority effect — each combines with the others by taking the *more* restrictive side.

Written the natural way — "use mine if I declared one" — a producer could declare its way *under* the floor its context set. Written as a join, it cannot. That is why an org's classification floor is not something a biome can opt out of.

### 3. Ownership is not access

The Space tree answers *containment*. The rank ladder answers *which of two rows at the same name wins*. **Neither answers permission.**

This is the law most likely to be broken by someone trying to be helpful. *"The org admin should see everything in their org"* sounds obviously true, and it would destroy the property that makes the rest worth having.

The property, concretely: a user Space `xema://users/<u>` walks to `[User, System]`. **The org is not in a user's ancestor chain.** A workflow you built for your own inbox is not reachable by containment from your organization, because your organization does not contain you in the addressing sense — it is a sibling in the tree, not an ancestor. Access to a specific instance comes from a grant or a share, and holding the *capability* is never the same as reaching the *instance*.

> Instance-level sharing — giving one named person access to one object, at a level, with an expiry — is being consolidated onto a single plane. Several surfaces carry their own version of it today. See [Permissions & Access](./xema-os/permissions.md) for what is enforced now.

---

## What you actually build with

| Primitive | What it is |
|---|---|
| **[Biome](./biomes/)** | An installable bundle — agents, skills, workflows, connectors, UI surfaces, and optionally a backend service. The unit of extension |
| **[Capability](./xema-os/capabilities.md)** | One named, versioned, callable action (`kb:page.read@1`). Every action in the system is one, and every call is policy-mediated |
| **[Agent](./xema-os/agent-composition/)** | Identity, prompt, skills, tools, and a recursive tree of sub-agents. Usable as an interactive session *and* as a workflow step — the same definition |
| **[Skill](./xema-os/skills/)** | A folder bundle that teaches an agent how to do something. Owned at a space, resolved most-specific-first |
| **[Workflow](./workflows/)** | A declarative YAML pipeline with typed inputs, gates, and durable execution |
| **[Connector](./xema-os/connectors.md)** | A typed integration with an external system. Credentials never leave the gateway |
| **[Workspace](./workspaces/)** | The persistent, isolated filesystem an agent session runs in |
| **[App](./xema-os/apps.md)** | A product surface composing biomes for an audience — including an audience of your customers, who have no Xema account |

---

## Properties worth choosing Xema for

**Each organization gets its own workflow-engine namespace.** Not a tenant column — a separate Temporal namespace, `xema-org-<orgId>`, provisioned on demand. Workflow state, history, signals, queries and visibility are scoped to it, and a retention policy the engine cannot confirm aborts the dispatch rather than running unprotected.

**Credentials are never handed to an agent.** An agent names a connection; the gateway mints a short-lived token bound to one invocation and one capability. A fully compromised agent process cannot leak a usable secret, because it never held one.

**An organization can have many accounts per provider.** Two Slack workspaces, a personal GitHub identity alongside an org app install, a project-specific Jira. Named connections at four owner tiers, exactly one default each, enforced by database constraints rather than application code — and if resolution is ambiguous it *errors* rather than picking, because picking is how a call silently reads the wrong mailbox.

**Execution can leave our infrastructure.** A runner is enrolled with explicit ceilings on the kinds, trust tiers, localities and environments it may ever claim, and its own attestation is checked against them. Customer-edge runners poll *outbound*, so NAT and corporate firewalls are not an obstacle.

**Your customers' end users are a first-class population.** An app mints short-lived delegated sessions for people who have no Xema account and never will. Every ingress door takes an app-client credential, routes through one audience policy, and is capped per client and per subject.

**The teaching surface is part of the product.** Agents working inside Xema read the same concept registry and the same skill bundles this documentation describes. When a concept changes, the thing agents are taught changes with it.

---

## Deployment shapes

The same platform, four ways: a laptop · a single-node appliance, with GPU · a managed multi-region cloud · a box at the customer's edge.

A concept that only works in one of them is not platform-grade, so none of them is a special build. What changes is the substrate, selected at launch (`xema up`, `xema serve --substrate …`), not the model.

---

## Where to start

**If you want to understand the system layer** — read [Xema OS](./xema-os/) in order: [Overview](./xema-os/overview.md), [Objects](./xema-os/objects.md), [Spaces](./xema-os/spaces.md), [Environments](./xema-os/environments.md), [Policy](./xema-os/policy.md), [Capabilities](./xema-os/capabilities.md).

**If you want to automate something today** — start with [Workflows](./workflows/) and the [Use Cases](./use-cases/).

**If you want to extend the platform** — read [Biomes](./biomes/) and the [SDK](./xema-os/sdk/getting-started.md), then run `xema biome scaffold`.

**If you want to embed Xema in your own product** — read [Apps](./xema-os/apps.md).

---

## Section index

| Section | What it covers |
|---|---|
| [Xema OS](./xema-os/) | The system layer: objects, capabilities, spaces, environments, policy, runners, the SDK |
| [Biomes](./biomes/) | Packaging domain capabilities as installable bundles |
| [Workflows](./workflows/) & [DSL](./dsl/) | Declarative pipelines and the language that describes them |
| [Interactive Sessions](./interactive-sessions/) | Live agent sessions for exploration, review, and hands-on work |
| [Workspaces](./workspaces/) & [Workspace Manifests](./workspace-manifests/) | The filesystem an agent works in, and how you declare it |
| [Templates](./templates/) & [Deliverables](./deliverables/) | Structured output contracts and how they are validated |
| [Databases](./databases/) | Org-managed relational databases with schema-per-biome isolation |
| [Notifications](./notifications/) | The bell and tasks fabric, recipient kinds, reusable groups |
| [APIs](./apis/) | The public API surface |
| [Use Cases](./use-cases/) | End-to-end examples, starter to advanced |

---

## FAQ

**Do I need to adopt all of it?**
No. Most teams start with one workflow or one agent session pattern. The primitives compose, but nothing requires you to meet a layer you have no use for — the default path for arming an agent, for instance, never shows you a capability name.

**Does it fit the systems we already run?**
That is what connectors are for. Source control, issue tracking, chat, mail, storage — inbound through one ingress edge, outbound through one gateway, and neither path puts a credential in your code.

**Can I run it where my data has to stay?**
Yes, and the honest form of that answer is on the [Runners](./xema-os/runners.md) page: enrollment ceilings, attestation, customer-edge pull transport, and exactly which residency classes the router can satisfy today.

**What is not built yet?**
This documentation says so where it applies, on the page where it matters, rather than in a roadmap nobody reads next to the feature. If a page describes something as planned or not implemented, take it literally.

[xema.dev](https://xema.dev)
