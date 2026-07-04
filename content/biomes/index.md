# Biomes

> API Docs: https://biome-host-api.xema.dev/api/docs

A **biome** is the Xema unit of distribution. One biome can ship agents, skills, tools, workflows, deliverable specs, document templates, mount sources, artifact types, connector bindings, frontend slot contributions, optional backend services, and storage schemas — all governed by a single declarative manifest and a fully-specified lifecycle.

## Quick Links

| Page | What it covers |
|---|---|
| [Concepts](./01-concepts.md) | BiomeLifecycle state machine, manifest anatomy, capability model |
| [Authoring](./02-authoring.md) | Writing `xema-biome.json`, contribution kinds, testing locally |
| [Store](./03-store.md) | Publishing to the Xema Store; OCI packaging; versioning |
| [Manifest Reference](./04-manifest-reference.md) | Field-by-field `xema-biome.json` reference, generated from the platform schema |
| [Examples](./examples/) | Runnable worked examples |

## Getting Started

Read in order:

1. **[Concepts](./01-concepts.md)** — understand the lifecycle and manifest before writing code.
2. **[Authoring](./02-authoring.md)** — write and validate your first biome.
3. **[Store](./03-store.md)** — package and publish when ready.
4. **[Examples](./examples/)** — see a minimal working biome from scratch.

Keep the [Manifest Reference](./04-manifest-reference.md) open while authoring — it is generated from the platform manifest schema, so it always matches what the biome host validates.

## FAQ

**Q: Can a biome ship a backend service?**
A: Yes. Put the service under `api/<name>/` and declare it in `xema.ships.apis[]`. The service is deployed by the biome host when the biome is org-installed and removed when it is archived.

**Q: How does a biome get capabilities?**
A: The biome declares `requiresCapabilities[]` in the manifest. At install time, an org admin reviews and approves a permission digest; the resulting grant is what the runtime checks. The biome never short-circuits that gate.
