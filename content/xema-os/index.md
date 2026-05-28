<!-- PHASE-N: full body — Zone vocabulary replaced by Environment+Space+Context+Policy per v4.3 §2 -->

# Xema OS

**Xema OS** is the system layer that turns Xema into an AI-native operating system for organizations. It defines the typed objects, the capability-mediated invocation plane, the execution environments, and the installable software bundles (biomes) that humans, agents, workflows, and external apps all share.

This section is the public reference for Xema OS — for org admins choosing what to install, for biome authors building extensions, and for integrators embedding Xema into their own products.

## Quick Links

| Page | What it covers |
|---|---|
| [Overview](./overview.md) | What Xema OS is, the six-layer model, the four primitives + Agent Composition |
| [Objects](./objects.md) | `XemaObject`, the typed universe, XVFS read path |
| [Capabilities](./capabilities.md) | Capability refs, the gateway, two-stage permission model |
| [Biomes](./biomes.md) | The installable software bundle, the seven-state lifecycle, the install flow |
| [Execution Environments](./environments.md) | The eight built-in environments, enforcement, environment grants |
| [Spaces](./spaces.md) | The seven-level SpaceRef hierarchy, URI grammar, data classification |
| [Execution Contexts](./execution-contexts.md) | The per-invocation envelope; what flows where |
| [Policy](./policy.md) | PolicyDecision shape, obligations, route hints, approval flow |
| [Runners](./runners.md) | Embedded, local-module, and remote runners; attestation; push vs pull |
| [Service Registry](./service-registry.md) | Service discovery + `@InjectService(name)` |
| [MCP and Capabilities](./mcp-and-capabilities.md) | The three meta-tools + external MCP federation |
| [Developer Annotations](./developer-annotations.md) | `@XemaResource` / `@XemaRoute` + convention inference |
| [CLI](./cli.md) | The global `xema` CLI — install, commands, workflows |
| [Skills](./skills/) | Skill bundles, 5-tier Space model, authoring and slash commands |
| [Agent Composition](./agent-composition/) | Recursive agent tree, CompositionLifecycle, Model Resolution Matrix |
| [Shell](./shell.md) | The unified command surface, WebSocket protocol, sandbox terminal |
| [Store](./store.md) | The five Store capabilities, listing lifecycle, install + submission flow |
| [Versioning](./versioning.md) | Draft vs published, lockfile shape, capability auto-bump |
| [Apps](./apps.md) | App model, delegated session JWT, audience policies, embed snippet |
| [SDK / Getting Started](./sdk/getting-started.md) | Author your first biome with the `xema` CLI |
| [SDK / Manifest](./sdk/manifest.md) | Every field of `xema-biome.json`, contribution kinds, lifecycle |
| [SDK / Contributions](./sdk/contributions.md) | Authoring the Contribution Protocol — `*.contribution.json` files |
| [SDK / Lifecycle Hooks](./sdk/lifecycle-hooks.md) | `onInstall`, `onUninstall`, `onUpgrade`, `onEnable`, `onDisable` |
| [SDK / Backend I ship](./sdk/backend-i-ship.md) | Multi-API biomes, base-path conventions, capability namespaces |
| [SDK / Storage](./sdk/storage.md) | Declared collections, isolation, `uninstallPolicy` |
| [SDK / Publishing](./sdk/publishing.md) | The four publishing transitions, bundle format, signing intent |
| [SDK / UI I contribute](./sdk/ui-i-contribute.md) | `HostExtensionSlots`, route contributions, nav registry |
| [SDK / Events I subscribe](./sdk/events-i-subscribe.md) | Declarative `subscribes[]`, CloudEvents envelope |
| [SDK / Testing](./sdk/testing.md) | Manifest validation, capability-stub tests, lifecycle hook tests |

## Getting Started

Read in order:

1. **[Overview](./overview.md)** — orient yourself in the six layers and the four-concept runtime model.
2. **[Objects](./objects.md)** — see how everything in Xema is a typed `XemaObject`.
3. **[Spaces](./spaces.md)** — where data lives and who owns it.
4. **[Execution Environments](./environments.md)** — the trust profiles capability calls run under.
5. **[Execution Contexts](./execution-contexts.md)** — the per-invocation envelope.
6. **[Policy](./policy.md)** — how every invocation is decided.
7. **[Capabilities](./capabilities.md)** — the invocation surface every call uses.
8. **[Biomes](./biomes.md)** — the lifecycle every installable bundle moves through.
9. **[Skills](./skills/)** — teach agents domain knowledge with folder bundles.
10. **[Agent Composition](./agent-composition/)** — build multi-agent pipelines with the Model Resolution Matrix.
11. **[Shell](./shell.md)** — the command surface humans and agents share.
12. **[CLI](./cli.md)** — install and use the `xema` binary.
13. **[SDK / Getting Started](./sdk/getting-started.md)** — author your first biome.
14. **[SDK / Manifest](./sdk/manifest.md)** — reference for every manifest field.

## Phase rollout

Xema OS lands in phases. This documentation tree grows in lockstep:

| Phase | New pages |
|---|---|
| 1A | Overview, Objects (intro), Capabilities (intro), SDK / Manifest, SDK / Getting Started |
| 1B | Capabilities (connector pilot section) |
| 2 | Objects (full XVFS) |
| 3 | Capabilities (gateway runtime) |
| 4 | Execution Environments, Spaces, Execution Contexts, Policy |
| 5 | Shell |
| 6 (this wave) | Biomes, SDK / Lifecycle Hooks, SDK / Backend I ship, SDK / Storage |
| 7 (this wave) | Apps |
| 8 (this wave) | Store, Versioning, SDK / Publishing |
| 9 (this wave) | SDK / UI I contribute, SDK / Events I subscribe, SDK / Testing |
