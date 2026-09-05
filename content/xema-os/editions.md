# Editions

An **edition** is a named, locked set of the things a Xema installation contains. It is the installation boundary: an edition is resolved once into a lockfile, and every consumer — the deploy plan, the boot filter, the air-gap build — reads that lockfile rather than re-deciding what is installed.

Choosing an edition is choosing how much platform you run. It is not choosing a feature tier: nothing is withheld from a smaller edition to sell you a larger one, and every edition is the same architecture with fewer parts.

---

## The three installation classes

Every component of the foundation declares how essential it is. That declaration — not its position in the dependency ladder — is what an edition is drawn from.

| class | the membership test |
|---|---|
| **core** | Remove it and either the seven governance questions cannot be answered, or no biome can be installed or run. This is the only strict test on this page. |
| **agentic** | The set almost everyone who runs agents and workflows wants. Deliberately *not* a strict test — a trivial workflow may produce no artifact and an agent may never publish a release. |
| **optional** | Reusable capability an installation can be complete and correct without. Still first-party, still generic, simply not mandatory. The decision is yours. |

A product surface — a chat experience, a shell, a domain biome — carries **no class at all**. It is not a less-essential part of the foundation; it is not part of the foundation. A distribution *selects* it.

---

## What each edition can do

| edition | contains | what it cannot do |
|---|---|---|
| **Minimal** | the governed floor alone: subjects and identity, spaces and ownership, authorization, the capability registry and router, decisions, the audit chain, the event bus, object identity, biome install, and the execution plane | runs no agents, no workflows, no workspaces. There is no model registry and no release plane. |
| **Agentic** | the floor plus agent sessions, skills, the model registry and resolution matrix, artifacts, the workflow engine, workspace orchestration and the tool gateway | no knowledge base, no external connections, no notifications, no app platform, no store, and no governed web access for agents |
| **Standard** | the floor, the agent set, and every optional first-party capability | nothing first-party is withheld; domain and customer biomes are still selected on top |
| **Appliance** | a single-node build for `linux/arm64`, sized for constrained hardware | a lean variant drops optional capabilities whose contracts nothing in the closure requires |

Adding a biome pulls **its own declared requirements** with it. Install a connector and you get the connection plane; install something that retrieves and you get the knowledge base. You never have to work out the closure by hand, and an edition that names a biome whose requirements are absent is refused when it is resolved — not discovered at boot.

---

## What it costs to run

The honest answer is that the cost is dominated by what runs continuously, and that is the service count.

- **Minimal** is roughly a dozen services. It is a governance and installation plane; it does not schedule agent work, so it needs no worker capacity and no model provider.
- **Agentic** roughly doubles that and adds the workspace plane. Agent work is bursty, so the steady-state cost is the control plane and the burst cost is whatever the agents actually do.
- **Standard** adds the optional capabilities as standing services, each with its own storage.

Every edition needs the same three pieces of backing infrastructure: a relational data store, a coordination store, and the workflow runtime. A smaller edition does not need less of them; it puts less through them.

---

## How an edition is chosen

Two rules decide almost every case.

1. **Start at the smallest edition that can do the thing you are adopting Xema for.** A governance-only adopter is a real customer, not a degenerate case: an organisation that wants grants, spaces, audit and installable biomes and no agents at all is served by Minimal, permanently.
2. **Add capability by selecting it, never by moving up a tier.** Editions are compositions, not rungs. Wanting one optional capability is a reason to select that capability, not a reason to run all of them.

An edition is a decision you can revisit. It is resolved into a lock, and re-resolving with a different selection is a normal operation.

---

## What an edition never changes

An edition changes what is INSTALLED. It never changes how anything BEHAVES.

- The same authorization decision path, with the same clamp order, in every edition.
- The same audit chain, the same ownership model, the same capability grammar.
- The same zero-configuration defaults: a fresh installation is safe and usable before anybody configures anything, in Minimal exactly as in Standard.
- No edition unlocks a permission, relaxes a fence, or changes the meaning of a grant.

A capability whose provider is not installed answers that no provider is installed. It does not fail obscurely, and it never silently succeeds.

---

**Previous**: [← Store](./store.md)
**Next**: [Versioning →](./versioning.md)
