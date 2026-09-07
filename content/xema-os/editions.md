# Editions

An **edition** is a named, locked set of the things a Xema installation contains. It is the installation boundary: an edition is resolved once into a lockfile, and every consumer — the deploy plan, the boot filter, the air-gap build — reads that lockfile rather than re-deciding what is installed.

Choosing an edition is choosing how much platform you run. It is not choosing a feature tier: nothing is withheld from a smaller edition to sell you a larger one, and every edition is the same architecture with fewer parts.

---

## The editions that ship

Six editions are resolved, locked and installable today.

| edition | what it is | what it cannot do |
|---|---|---|
| `minimal` | the smallest **dependency-complete** edition — the floor, plus everything the floor's own declared requirements pull in. It carries the agent runtime, the knowledge base, connections, mail and governed web access, because components in the floor require them. | no store, no notifications hub, no activity feed, no document rendering, no conversation channels, no control plane, and none of the end-user web surfaces |
| `starter` | a named product set on top of the floor: the conversational surface, the Agent Studio, Apps, the knowledge base, Memory and Search | not the whole platform tier — no metered LLM economy, no distribution plane, no storefront |
| `appliance-lean` | the footprint-constrained single-node appliance, sized for constrained hardware | drops the store, notifications, document rendering, conversation channels, the control plane and the end-user web surfaces |
| `appliance-base` | the full single-node appliance — everything at platform tier as well | no storefront, no metered LLM economy, no distribution plane |
| `oss` | the open edition: the floor plus every platform-tier capability, self-hosted | no metered LLM economy, and no plans or paid users — it runs billing-free by design |
| `cloud` | the hosted edition Xema operates for you; the only one that carries usage metering and the distribution plane | nothing first-party is withheld; domain and customer biomes are still selected on top |

The two appliance editions are built for `linux/arm64`; the other four are `linux/amd64`. Where the constraint is the hardware rather than the capability set, that decides first.

Adding a biome pulls **its own declared requirements** with it. Install a connector and you get the connection plane; install something that retrieves and you get the knowledge base. You never have to work out the closure by hand, and an edition that names a biome whose requirements are absent is refused when it is resolved — not discovered at boot.

### Two names that are not choices

- **`core` is not a shippable edition.** It is the substrate catalogue every other edition composes from — the kernel, system and base tiers plus the platform substrate. No deployment installs it. You will see the name in lockfiles and in the manifests of the editions that extend it.
- **`xema-internal` is the Xema team's own operator installation.** It is not available for customer installation, and it is named here only so it is not a silent gap when you meet it.

---

## Two more are written and not yet available

Two further editions are drawn a different way — directly from what each component declares about itself, rather than by taking a tier and subtracting from it.

| edition | what it would be | status |
|---|---|---|
| `xema-minimal` | the governed floor and nothing else: it answers the seven governance questions and can install and run a biome. **It runs no agents.** | manifest written; **no lock, not installable** |
| `xema-agentic` | the floor plus the agent runtime, the model registry, skills, artifacts, workflows and workspace orchestration — the smallest genuinely useful Xema for agent work | manifest written; **no lock, not installable** |

Do not plan against either yet. Neither has a resolved lock, so neither can be installed, and no figure quoted for them describes a shipped artifact.

**`xema-minimal` is not a smaller `minimal`.** They are different answers to different questions and both are correct. `minimal` is derived from the floor **by exclusion** and is dependency-complete, so it carries the agent runtime. `xema-minimal` is drawn **by class** and carries only what the floor's own membership test admits. The class-drawn one stays small as the platform grows; the dependency-complete one grows with the floor's requirements.

---

## The three installation classes

Every component of the foundation declares how essential it is. That declaration is what the two class-drawn editions above are built from, and it is the vocabulary the rest of this page uses.

| class | the membership test |
|---|---|
| **core** | Remove it and either the seven governance questions cannot be answered, or no biome can be installed or run. This is the only strict test on this page. |
| **agentic** | The set almost everyone who runs agents and workflows wants. Deliberately *not* a strict test — a trivial workflow may produce no artifact and an agent may never publish a release. |
| **optional** | Reusable capability an installation can be complete and correct without. Still first-party, still generic, simply not mandatory. The decision is yours. |

The class named **core** and the catalogue named `core` are different things that share a word: one is a component's own declaration of how essential it is, the other is the substrate every edition composes from.

A product surface — a chat experience, a shell, a domain biome — carries **no class at all**. It is not a less-essential part of the foundation; it is not part of the foundation. A distribution *selects* it.

---

## What it costs to run

The honest answer is that the cost is dominated by what runs continuously, and that is the service count.

| edition | biomes | services | platform |
|---|---|---|---|
| `minimal` | 51 | 38 | `linux/amd64` |
| `appliance-lean` | 57 | 42 | `linux/arm64` |
| `starter` | 66 | 48 | `linux/amd64` |
| `appliance-base` | 109 | 55 | `linux/arm64` |
| `oss` | 111 | 55 | `linux/amd64` |
| `cloud` | 114 | 57 | `linux/amd64` |

**These counts move.** They are read out of the committed lockfiles, and a lock is re-resolved whenever the platform changes. The lock is the authority; this table is a snapshot of it, not a second source of truth.

Two things the table does not show. Every edition rests on the same eight pieces of backing substrate — the hosted edition adds a ninth for metering — so the substrate is very nearly a constant and the biome and service counts are what actually move. And `minimal` still schedules agent work, so it needs worker capacity and a model provider; it is the cheapest complete installation, not a dormant one.

Every edition needs the same backing infrastructure: a relational data store, a coordination store, and the workflow runtime. A smaller edition does not need less of them; it puts less through them.

---

## How an edition is chosen

Two rules decide almost every case.

1. **Start at the smallest edition that can do the thing you are adopting Xema for.** If you are adopting Xema to run agents and want nothing else standing, that is `minimal`. If you want the product surfaces on day one, that is `starter`.
2. **Add capability by selecting it, never by moving up a tier.** Editions are compositions, not rungs. Wanting one optional capability is a reason to select that capability, not a reason to run all of them.

An edition is a decision you can revisit. It is resolved into a lock, and re-resolving with a different selection is a normal operation.

---

## What an edition never changes

An edition changes what is INSTALLED. It never changes how anything BEHAVES.

- The same authorization decision path, with the same clamp order, in every edition.
- The same audit chain, the same ownership model, the same capability grammar.
- The same zero-configuration defaults: a fresh installation is safe and usable before anybody configures anything, in `minimal` exactly as in `cloud`.
- No edition unlocks a permission, relaxes a fence, or changes the meaning of a grant.

A capability whose provider is not installed answers that no provider is installed. It does not fail obscurely, and it never silently succeeds.

---

**Previous**: [← Store](./store.md)
**Next**: [Versioning →](./versioning.md)
