# Xema OS

**Xema OS** is the system layer that turns Xema into an AI-native operating system for organizations. It defines the typed objects, the capability-mediated invocation plane, the execution environments, and the installable software bundles (biomes) that humans, agents, workflows, and external apps all share.

This section is the public reference for Xema OS — for org admins choosing what to install, for biome authors building extensions, and for integrators embedding Xema into their own products.

## Quick Links

| Page | What it covers |
|---|---|
| [Overview](./overview.md) | What Xema OS is, the conceptual architecture layers, and the four Agent primitives |
| [Objects](./objects.md) | `XemaObject`, the typed universe, XVFS read path |
| [Capabilities](./capabilities.md) | Capability refs, the gateway, two-stage permission model |
| [Connectors](./connectors.md) | Typed integration points, named multi-account connections, wallet credentials, OAuth flow |
| [Biomes](./biomes.md) | The installable software bundle, the seven-state lifecycle, the install flow |
| [Execution Environments](./environments.md) | The nine built-in environments, the reach ceiling, environment grants |
| [Spaces](./spaces.md) | The seven-level SpaceRef hierarchy, URI grammar, data classification, re-scoping |
| [Execution Contexts](./execution-contexts.md) | The per-invocation envelope; what flows where |
| [Policy](./policy.md) | `PolicyDecision` shape, the closed obligation set, route hints, credential selection, approval flow |
| [Permissions & Access](./permissions.md) | The whole access model — capabilities, grants, roles, teams, agent reach tiers, auto-grant |
| [Profiles](./profiles.md) | Named grant bundles attached to subjects — **planned, not implemented** |
| [Runners](./runners.md) | The runner kinds, execution targets, enrollment ceilings, attestation, push vs pull, the selector |
| [Controllers](./controllers.md) | Reconciliation loops, desired vs observed state, error categories |
| [Service Registry](./service-registry.md) | Service discovery + `@InjectService(name)` |
| [MCP and Capabilities](./mcp-and-capabilities.md) | The six meta-tools + external MCP federation |
| [Developer Annotations](./developer-annotations.md) | `@XemaResource` / `@XemaRoute` + convention inference |
| [CLI](./cli.md) | The global `xema` CLI — install, commands, workflows |
| [Xema-as-Code](./iac.md) | Declarative provisioning — `xema.yaml`, the Terraform provider, the `managedBy` ownership model |
| [Skills](./skills/) | Skill bundles, Space ownership, authoring and slash commands |
| [Agent Composition](./agent-composition/) | Recursive agent tree, agent lifecycle, Model Resolution Matrix |
| [Shell](./shell.md) | The unified command surface, WebSocket protocol, sandbox terminal |
| [Store](./store.md) | The five Store capabilities, listing lifecycle, install + submission flow |
| [Versioning](./versioning.md) | Draft vs published, rollback as a pointer flip, lockfile shape, capability auto-bump |
| [Apps](./apps.md) | App model, delegated sessions and the signing key ring, audience policies, ingress caps, embed snippet |
| [SDK / Getting Started](./sdk/getting-started.md) | Author your first biome with the `xema` CLI |
| [Manifest Reference](../biomes/04-manifest-reference.md) | Generated, field-by-field contract for the current `xema-biome.json` schema |
| [SDK / Contributions](./sdk/contributions.md) | Authoring the Contribution Protocol — `*.contribution.json` files |
| [SDK / Lifecycle Hooks](./sdk/lifecycle-hooks.md) | `onInstall`, `onUninstall`, `onUpgrade`, `onEnable`, `onDisable` — declared, not yet invoked |
| [SDK / Backend I ship](./sdk/backend-i-ship.md) | Component-based service, worker, job, adapter, content, and web artifacts |
| [SDK / Storage](./sdk/storage.md) | Declared collections, isolation, `uninstallPolicy` |
| [SDK / Publishing](./sdk/publishing.md) | The four publishing transitions, bundle format, signing intent |
| [SDK / UI I contribute](./sdk/ui-i-contribute.md) | `HostExtensionSlots`, route contributions, nav registry |
| [SDK / Events I consume](./sdk/events-i-subscribe.md) | Per-service event consumers, CloudEvents envelope |
| [SDK / Testing](./sdk/testing.md) | Manifest validation, capability-stub tests, lifecycle hook tests |

## Getting Started

Read in order:

1. **[Overview](./overview.md)** — orient yourself in the conceptual layers and the four-concept runtime model.
2. **[Objects](./objects.md)** — see how everything in Xema is a typed `XemaObject`.
3. **[Spaces](./spaces.md)** — where data lives and who owns it.
4. **[Execution Environments](./environments.md)** — the trust profiles capability calls run under.
5. **[Execution Contexts](./execution-contexts.md)** — the per-invocation envelope.
6. **[Policy](./policy.md)** — how every invocation is decided.
7. **[Permissions & Access](./permissions.md)** — the whole access model + the agent reach-tier ceiling.
8. **[Capabilities](./capabilities.md)** — the invocation surface every call uses.
9. **[Biomes](./biomes.md)** — the lifecycle every installable bundle moves through.
10. **[Skills](./skills/)** — teach agents domain knowledge with folder bundles.
11. **[Agent Composition](./agent-composition/)** — build multi-agent pipelines with the Model Resolution Matrix.
12. **[Shell](./shell.md)** — the command surface humans and agents share.
13. **[CLI](./cli.md)** — install and use the `xema` binary.
14. **[Xema-as-Code](./iac.md)** — provision the platform declaratively with `xema.yaml` or Terraform.
15. **[SDK / Getting Started](./sdk/getting-started.md)** — author your first biome.
16. **[Manifest Reference](../biomes/04-manifest-reference.md)** — reference for every current manifest field.
