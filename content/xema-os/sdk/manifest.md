# SDK — Biome Manifest

The biome manifest is the declarative entry point for everything a biome ships. The current contract is generated directly from the Kernel schema at [Manifest Reference](../../biomes/04-manifest-reference.md); use that page for exact fields, enum values, and required properties.

This page explains the design rather than duplicating the generated schema.

---

## Top-level shape

```jsonc
{
  "name": "@your-scope/your-biome",
  "version": "1.0.0",
  "xema": {
    "id": "your-biome",
    "displayName": "Your Biome",
    "scope": "platform",
    "target": "server",
    "components": []
  }
}
```

`xema.target` selects the server or web manifest shape. `xema.scope` is the enforced dependency and boot tier: `kernel`, `system`, `base`, or `platform`. Customer and third-party biomes use `platform`.

---

## Components are authoritative

`xema.components[]` is the current artifact model. Each entry describes one `content`, `web`, `adapter`, `service`, `worker`, or `job` component and includes:

- an artifact kind and `artifact.path`;
- an entrypoint and protocol;
- supported execution modes;
- complete runtime requirements for tenancy, isolation, trust, locality, state, resources, runtime, I/O, scaling, readiness, and drain.

The retired `ships.apis[]` shape must not be used for new manifests.

---

## Content and contributions

Multi-file content is discovered from documented convention directories. Typed single-file contributions are delivered through `xema.contributions.directory` and/or `xema.contributions.inline[]`.

Agents and provisioning scaffolds also have explicit manifest rosters that are checked against their files.

---

## Capability and permission declarations

- `requiresCapabilities[]` states what the biome may request.
- `exposesCapabilities[]` states what the biome implements.
- `ownsCapabilityDomains[]` declares domains it owns where applicable.
- `permissions` supplies the install-time recommendation and human-readable reasons.

These fields describe intent. Runtime authority still comes from the current subject, Space, Execution Environment, Agent arming, resource reach, and policy decision.

---

## Dependencies and installation requirements

Use manifest dependencies and requirement blocks to make installation prerequisites explicit. A host should refuse an unsatisfied dependency or runtime requirement instead of booting a partial biome.

Lifecycle-hook paths are schema-valid declarations but are not currently invoked by the host. See [Lifecycle Hooks](./lifecycle-hooks.md).

---

## Exact reference

Read [Biomes → Manifest Reference](../../biomes/04-manifest-reference.md). That page is generated from the current runtime schema and is the only public field-by-field reference.

---

**Previous**: [← Getting Started](./getting-started.md)
**Next**: [Contributions →](./contributions.md)
