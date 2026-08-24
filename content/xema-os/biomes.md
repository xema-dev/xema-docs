# Biomes

A **biome** is Xema's unit of extension and distribution. It packages a coherent domain or integration without modifying the Kernel or reaching into another biome's implementation.

A biome may ship:

- Agents and Skills;
- Workflows and structured deliverable specifications;
- capability and connector contributions;
- workspace manifests and provisioning scaffolds;
- UI bundles and host-surface contributions;
- optional services, workers, jobs, or adapters;
- install-time permission and integration requirements.

Biomes are how an organization grows a fresh Xema installation into the platform it needs. The base platform supplies shared operating capabilities; customer and domain biomes add the business layer.

---

## The current manifest model

Every biome has a `xema-biome.json` manifest. The current contract is component-based: `xema.components[]` is the authoritative list of artifacts the biome ships. The earlier `ships.apis[]` shape is retired.

Each component declares:

- `key` and `kind` — `content`, `web`, `adapter`, `service`, `worker`, or `job`;
- `artifact.kind` and `artifact.path` — the package content, web bundle, host module, or OCI image;
- `entrypoint` and `protocol` — how the host starts it and how other platform surfaces interact with it;
- `executionModes` — materialized, web-hosted, shared-host, composed, isolated, or runner;
- `requirements` — tenancy, isolation, trust, locality, state, resources, runtime, I/O, scaling, readiness, and drain behavior.

This makes runtime requirements machine-readable. Placement and deployment do not depend on a folder name or an undocumented convention.

```jsonc
{
  "name": "@acme/operations",
  "version": "1.0.0",
  "xema": {
    "id": "operations",
    "displayName": "Operations",
    "scope": "platform",
    "target": "server",
    "components": [
      {
        "key": "operations-content",
        "kind": "content",
        "artifact": { "kind": "package-content", "path": "." },
        "entrypoint": { "kind": "materialize" },
        "protocol": { "kind": "none" },
        "executionModes": ["materialized"],
        "requirements": {
          "tenancy": { "allowed": ["org", "project"], "tenantContext": "verified" },
          "isolation": { "minimum": "none" },
          "trust": { "minimum": "untrusted" },
          "locality": { "allowed": ["cloud", "customer-private"] },
          "state": { "kind": "stateless" },
          "resources": { "minimum": { "cpu": "1m", "memory": "1Mi", "ephemeralStorage": "1Mi" } },
          "runtime": { "kind": "none" },
          "io": { "ingress": "none", "egress": "none", "rawBody": false, "devices": [] },
          "scaling": {
            "mode": "singleton",
            "concurrency": { "handling": "serial", "maximumPerInstance": 1 },
            "readiness": { "kind": "none" },
            "drain": { "kind": "none" },
            "hints": { "cpu": "steady", "memory": "steady", "startup": "fast" }
          }
        }
      }
    ]
  }
}
```

Use the generated [Manifest Reference](../biomes/04-manifest-reference.md) for the exact schema. It is generated from the same contract the host validates.

---

## Scope tiers and dependency rules

`xema.scope` is one of four enforced boot and dependency tiers:

| Scope | Purpose |
|---|---|
| `kernel` | The smallest platform foundation |
| `system` | System-wide operating services |
| `base` | Shared capabilities used by domain products |
| `platform` | Domain, integration, and customer biomes |

Third-party and customer biomes use `platform`. Lower tiers are reserved for the platform foundation.

The important boundary is capability-based composition:

- Kernel packages do not import biomes.
- One biome does not import another biome's implementation.
- Cross-biome work happens through published contracts and capabilities.

This lets domain teams evolve independently while preserving one policy and audit funnel.

---

## Content and contributions

Biomes extend Xema through three explicit channels:

1. **Components** describe every executable or materialized artifact.
2. **Convention content directories** hold multi-file content such as Agents, Skills, Workflows, workspace manifests, and deliverable specs.
3. **Contribution envelopes** under `contributions/` or `xema.contributions.inline[]` carry typed single-file extension records.

Nothing is loaded merely because arbitrary code exists in the bundle.

The Agent and provisioning directories have manifest rosters that are cross-validated against files. Drift fails activation rather than silently omitting content.

---

## Install-time consent and runtime authority

A manifest can declare required and exposed capabilities plus human-readable permission hints. That declaration is not itself a grant.

At installation, the platform presents the requested capability set and permission context for review. At runtime, every capability invocation is checked again against the acting subject, resource, Space, Execution Environment, Agent arming, and current policy.

A biome therefore cannot turn a manifest declaration into authority by itself.

---

## Distribution and supply chain

Biomes can be distributed as OCI artifacts. The distribution model supports signatures, provenance evidence, content-addressed locks, and offline verification workflows.

Published versions are immutable inputs to installation and deployment. Promotion and rollback are deliberate lifecycle operations; a mutable source directory is not a production version.

See [Biome Supply Chain](./security/biome-supply-chain.md) and [Versioning](./versioning.md).

---

## What a new customer should build

A new installation should start with the Xema foundation and add only the domain biomes it needs. A useful first decomposition is:

- one integration biome defining provider-neutral capability contracts and canonical events;
- one domain biome containing the first Agents, Skills, Workflows, and experience contributions;
- separate web components when a customer-specific product surface is needed.

Existing Xema application biomes are examples of what can be built, not a mandatory application portfolio.

---

## Related concepts

- [Biome concepts](../biomes/01-concepts.md)
- [Authoring](../biomes/02-authoring.md)
- [Manifest Reference](../biomes/04-manifest-reference.md)
- [Capabilities](./capabilities.md)
- [Execution Environments](./environments.md)
- [Store](./store.md)
- [Apps](./apps.md)

---

**Previous**: [← Capabilities](./capabilities.md)
**Next**: [Shell →](./shell.md)
