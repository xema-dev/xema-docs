# Workspace Manifests

> API Docs: https://llm-registry-api.xema.dev/api/docs

**Workspace Manifests** are declarative YAML specifications that define the complete environment for an agent — what files, repos, knowledge, and tools are placed into the workspace before the agent starts working.

A workspace manifest is an **authoring format**. At biome install time the platform compiles each manifest into a published **Agent Composition** in the LLM Registry — that composition is the runtime primitive the platform actually executes against. Manifests give biome authors a focused, ergonomic shape for declaring "what an agent needs to see"; agent compositions give the runtime a single recursive shape for both interactive sessions and workflow steps.

Think of a workspace manifest as a virtual disk image: every byte the agent sees is declared in the manifest, assembled from authoritative sources, and applied atomically before the session begins.

## Quick Links

| Page | What it covers |
|---|---|
| [01 Concepts](./01-concepts.md) | Workspace Image model, manifest DSL, scope hierarchy |
| [02 Authoring](./02-authoring.md) | Full YAML field reference with runnable examples |
| [03 DSL Reference](./03-dsl-reference.md) | Schema structure, validation tiers, expression syntax |
| [04 Mounts Reference](./04-mounts-reference.md) | Complete guide to all mount slots and configurations |
| [05 Environment Blocks](./05-environment-blocks.md) | Surface compatibility, display metadata, sub-agents, skills, MCP, credentials, permissions, persistence, preview surface, resume drift |

## Getting Started

Ordered reading path for new integrators:

1. **[Concepts](./01-concepts.md)** — understand what a workspace manifest is and how it fits into sessions and workflow jobs
2. **[Authoring](./02-authoring.md)** — learn to write manifests (inputs, mounts, agent slot, seed files, env vars)
3. **[Environment Blocks](./05-environment-blocks.md)** — declare the full runtime topology (sub-agents, skills, MCP services, credentials, permissions, persistence, preview surface, surface compatibility)
4. **[Mounts Reference](./04-mounts-reference.md)** — deep dive into mount slots and access modes
5. **[DSL Reference](./03-dsl-reference.md)** — schema validation, expressions, error handling

## Where Manifests Are Used

| Consumer | How |
|---|---|
| Interactive sessions | Each session resolves the workspace defined by its agent composition and applies it before the session becomes active |
| Workflow jobs | Agent jobs (`xema/agent`) reference an environment via the DSL contract `workspace-manifest@v1` (`workspaceManifestRef: slug@version`) or the newer `agent-composition@v1` (`agentCompositionRef: slug@version`); the compiler also accepts an inline `mounts:` block as shorthand |
| Biome contributions | Biomes ship manifests under `workspace-manifests/*.workspace.yaml`; on biome install each manifest is compiled and seeded into the LLM Registry as a published agent composition available to all orgs |

## Schema

Workspace manifests are validated by the `@xemahq/workspace-manifest-dsl` compiler, which holds the authoritative schema. Annotate the YAML so an IDE can offer completion:

```yaml
# yaml-language-server: $schema=https://xema.dev/schemas/workspace/v1/WorkspaceManifest.json
apiVersion: xema.dev/workspace/v1
kind: WorkspaceManifest
...
```

## FAQ

**Q: Do I need to write manifests for every session?**
A: No. The platform ships system manifests for common patterns (brainstorming, engineering, architecture review, etc.) via the `software-dev` biome. Most teams start by referencing one of these and only author custom manifests when they need different mounts or seed files.

**Q: How are manifests different from deliverable specs?**
A: A deliverable spec defines the *output contract* (what the agent must produce). A workspace manifest defines the *environment* (what the agent can see and use). Both can be referenced in the same session or job.

**Q: How do I customize a manifest for my org?**
A: Ship a biome that contributes a manifest under `workspace-manifests/*.workspace.yaml`. On install, the manifest is compiled and seeded into the LLM Registry as an agent composition your org can select.

**Q: Are workspace manifests the runtime model, or is it agent compositions?**
A: Agent compositions are the runtime model — the recursive primitive the platform resolves at session start and at every workflow agent step. Workspace manifests are the authoring format: a focused YAML shape that compiles 1:1 into a published agent composition at install time. You can author either; the runtime sees the same compiled composition.
