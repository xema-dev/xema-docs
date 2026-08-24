# SDK — Components I Ship

A biome can ship zero or more executable components. The current manifest declares them in `xema.components[]`; the earlier `ships.apis[]` model is retired.

---

## Component kinds

| Kind | Purpose |
|---|---|
| `content` | Materialized Agents, Skills, Workflows, schemas, and other packaged content |
| `web` | Static bundle hosted by the Xema web shell |
| `adapter` | Module implementing a declared host adapter protocol |
| `service` | Long-running request-serving component |
| `worker` | Long-running queue or event worker |
| `job` | Finite, scheduled, or one-shot component |

Each component combines an artifact, entrypoint, protocol, execution modes, and runtime requirements. See the generated [Manifest Reference](../../biomes/04-manifest-reference.md#xemacomponents) for the exact shape.

---

## When to ship executable code

Ship a service, worker, job, or adapter when the biome needs behavior that declarative content cannot express, such as:

- a long-running request, event, or queue consumer;
- a custom capability implementation;
- a provider adapter;
- domain persistence with non-trivial invariants;
- scheduled reconciliation;
- a protocol surface such as HTTP or a worker queue.

Do not ship a service merely to register Agents, Skills, Workflows, or contribution envelopes. A content component can materialize those.

---

## Runtime requirements are part of the contract

An executable component must declare:

- allowed tenancy scopes and verified tenant context;
- minimum isolation and trust;
- allowed locality;
- state kind, persistence, consistency, and tenant fencing where durable;
- minimum and preferred resources plus optional accelerator needs;
- runtime kind and supported version;
- ingress, egress, raw-body, and device requirements;
- scaling mode, concurrency, readiness, graceful drain, and workload hints.

The operator and scheduler use these declarations when deciding whether and where the component can run. A requirement is not documentation-only metadata.

---

## HTTP services and capabilities

An HTTP component declares its protocol revision, stable service name, authentication scopes, service dependencies, and any exposed capabilities.

Other biomes must not import its implementation or invent a direct dependency on its deployment address. Cross-biome operations use published clients where appropriate and the capability plane for domain actions, preserving authorization and audit.

---

## Scaling and lifecycle

Horizontal components declare per-instance concurrency, readiness behavior, and a drain contract. This lets rollouts stop accepting new work and complete or hand off in-flight work deliberately.

The deployment profile supplies the physical replicas and substrate; the biome supplies the workload requirements.

---

## Related pages

- [Manifest Reference](../../biomes/04-manifest-reference.md)
- [Authoring](../../biomes/02-authoring.md)
- [Capabilities](../capabilities.md)
- [Runners](../runners.md)
- [Lifecycle Hooks](./lifecycle-hooks.md)

---

**Previous**: [← Lifecycle Hooks](./lifecycle-hooks.md)
**Next**: [Storage →](./storage.md)
