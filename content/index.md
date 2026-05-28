# Xema

> API Docs: https://docs-api.xema.dev/api/docs

**Xema** is a platform for teams that want AI-native execution with explicit workflows, governed reviews, reusable workspaces, and durable knowledge.

[xema.dev](https://xema.dev)

---

## What it is

Xema gives organizations a structured way to put AI to work across product, engineering, and platform operations. Instead of treating each prompt or agent session as an isolated action, Xema lets teams define repeatable execution, attach the right context, validate outcomes, and keep the resulting knowledge.

Workflows, interactive sessions, workspace manifests, deliverable specs, and biomes all work together as one operating model. The result is AI execution that stays inspectable, reviewable, and adaptable to the way your teams already work.

## Quick Links

### Learn The Platform

| Section | What it covers |
|---|---|
| [Workflows](./workflows/) | Define and run repeatable multi-step Xema workflows |
| [Interactive Sessions](./interactive-sessions/) | Launch live agent sessions for collaborative work |
| [Workspace Manifests](./workspace-manifests/) | Define reusable agent workspaces with scoped context |
| [Templates](./templates/) | Describe structured deliverables and reusable output contracts |
| [Notifications](./notifications/) | Bell + tasks fabric, recipient kinds, and reusable groups |

### Build And Integrate

| Section | What it covers |
|---|---|
| [Use Cases](./use-cases/) | See end-to-end examples from starter to advanced |
| [APIs](./apis/) | Browse the public API entry points and integration surface |
| [DSL](./dsl/) | Learn the workflow language, expressions, and authoring model |

### Extend Xema

| Section | What it covers |
|---|---|
| [Biomes](./biomes/) | Package and install domain-specific capabilities: skills, agents, workflows, UI, and services |
| [Workspaces](./workspaces/) | Persistent, isolated environments for agent sessions — storage, git workflow, multi-user |
| [Databases](./databases/) | Org-managed relational databases with schema-per-biome isolation and workflow-orchestrated migrations |
| [Xema OS](./xema-os/) | The system layer: typed objects, capabilities, zones, skills, agent composition, and the SDK |

---

## Core Platform Surfaces

**Workflows** — define multi-step execution flows with typed inputs, repeatable steps, and clear triggers.

**Interactive sessions** — start live agent sessions when a task needs exploration, review, debugging, or guided execution.

**Workspace manifests** — define what an agent can see in its workspace: repositories, references, seed files, deliverables, and environment variables.

**Deliverable specs** — describe what a successful output looks like so the result can be reviewed, validated, and reused.

**Knowledge and artifacts** — keep requirements, reports, reviews, plans, and generated outputs persisted, versioned, and queryable.

**Integrations** — connect Xema to source control, issue tracking, messaging, and other systems that need to trigger work or consume outcomes.

---

## Who it is for

**Engineering teams** — automate code review, spec generation, technical audits, and delivery workflows with consistent review points.

**Platform teams** — define reusable workflows, workspace manifests, and extension surfaces that other teams can adopt without rebuilding the foundation.

**Product teams** — turn briefs, backlogs, and decisions into structured execution that stays aligned with delivery and review.

**Extension authors** — package domain-specific capabilities as biomes, workflows, UI surfaces, and services on top of the platform.

---

## Biomes

Biomes are how teams package domain-specific capabilities on top of Xema. A biome is an npm package with a `xema-biome.json` manifest.

A biome can contribute:

- Workflows and actions — reusable execution logic and domain behaviors
- Frontend pages and nav items — new UI surfaces in the platform shell
- Backend services — service extensions with standard platform contracts
- Mount sources — custom data sources for agent workspaces
- Deliverable specs — structured output contracts for generated results
- Skills and agent definitions — reusable knowledge bundles and execution specializations

The first-party biome is **software-dev**. It brings the full engineering workflow surface — code review, spec generation, PR automation — and is the reference for biome authors.

[Build a biome →](./biomes/)

---

## Workspaces

Every agent session runs in an isolated, persistent workspace. Workspaces are backed by durable storage that survives pod restarts and session pauses — agents pick up exactly where they left off.

Workspaces include:

- **Persistent storage** — PVC-backed per session with org/project/session isolation
- **Git workflow** — auto-commit per turn, publish-to-prod, branch policy, conflict resolution
- **Multi-user sessions** — multiple humans and agents collaborating with full actor attribution
- **Versioning lockfile** — pins all biome, agent, skill, and image versions for reproducibility

[Learn about workspaces →](./workspaces/)

---

## Databases

Xema provides org-managed relational databases — fully isolated, platform-provisioned storage for biomes and apps. Each org gets its own database; each biome and app gets its own schema within it.

Key features:

- **Schema-per-biome isolation** — broken migrations in one schema never affect another
- **Workflow-orchestrated migrations** — safe, observable schema changes via the Xema Workflow Runtime
- **Pluggable migration runners** — the v1 runner ships with the platform; the interface supports Drizzle, Flyway, raw SQL
- **Short-lived credentials** — no static shared passwords; credentials expire after a configurable TTL
- **Dev/Prod schema model** — apps develop against a dev schema and promote changes to prod explicitly

[Learn about databases →](./databases/)

---

## Getting Started

1. **[Read the workflows overview](./workflows/)** — understand the repeatable execution model.
2. **[Explore interactive sessions](./interactive-sessions/)** — see how live agent work fits alongside workflows.
3. **[Learn workspace manifests](./workspace-manifests/)** — define the context each agent gets.
4. **[Review templates](./templates/)** — describe the outputs your workflows should produce.
5. **[Browse use cases](./use-cases/)** — see how the pieces fit together in real flows.
6. **[Use the APIs and DSL reference](./apis/)** — integrate programmatically and validate authored definitions.
7. **[Explore biomes](./biomes/)** — extend the platform for your own domain.
8. **[Learn about workspaces](./workspaces/)** — persistent environments, git workflow, multi-user collaboration.
9. **[Set up databases](./databases/)** — org-managed relational databases with schema isolation and safe migrations.

---

## What you can build

**Automated code review** — trigger on PR open, run an agent against the diff, post a structured review back to GitHub.

**Scheduled audit flows** — run recurring review or analysis workflows across repos, projects, or policies and keep the findings as durable artifacts.

**Spec generation** — turn a backlog item or product brief into a detailed technical specification with reviewable outputs.

**Interactive engineering sessions** — launch governed workspaces for debugging, implementation, investigation, or hands-on collaboration with agents.

**Product-specific platform experiences** — build domain workflows and UI surfaces on top of the same execution and governance model.

Any repeatable workflow your team runs today is a candidate.

[Understand the public APIs →](./apis/)

---

## FAQ

**Q: Do I need to use every part of Xema to get started?**
A: No. Many teams start with one workflow or one interactive session pattern, then expand into reusable manifests, deliverable specs, and biomes as adoption grows.

**Q: Can Xema fit existing engineering and product systems?**
A: Yes. Xema is designed to integrate with the systems teams already use for source control, work tracking, messaging, and other operational triggers.

**Q: Where should I start if I want reusable agent context?**
A: Start with [Workspace Manifests](./workspace-manifests/). They define what an agent can access during execution.

[xema.dev](https://xema.dev)
