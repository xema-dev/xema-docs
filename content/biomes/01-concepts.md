# Biome Concepts

A **biome** is a folder bundle with a `xema-biome.json` manifest at its root. It is the unit through which Xema gains a domain, integration, product surface, or shared platform capability.

The manifest declares what the biome ships and what every executable component requires. The platform decides where a component can run by matching those declarations against the installation and available execution targets.

---

## Three extension channels

A biome extends Xema through exactly three explicit channels:

1. **Components** — executable or materialized artifacts declared in `xema.components[]`.
2. **Convention content directories** — multi-file content such as Agents, Skills, Workflows, deliverable specs, and workspace manifests.
3. **Contribution envelopes** — typed single-file records under `contributions/` or `xema.contributions.inline[]`.

This separation matters. A service, an Agent definition, and a capability record have different lifecycle and runtime needs; the manifest represents each without treating all extension content as executable code.

---

## The manifest

`xema-biome.json` is a wrapped `{ "name", "version", "xema": { … } }` document. A server biome requires at least one component:

```json
{
  "name": "@acme/customer-operations",
  "version": "1.0.0",
  "xema": {
    "id": "customer-operations",
    "displayName": "Customer Operations",
    "scope": "platform",
    "target": "server",
    "components": [
      {
        "key": "content",
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
            "hints": { "cpu": "batch", "memory": "steady", "startup": "fast" }
          }
        }
      }
    ]
  }
}
```

Key fields:

| Field | Purpose |
|---|---|
| `name` and `version` | Package identity and immutable version input |
| `xema.id` | Stable biome identifier |
| `xema.target` | `server` or `web` manifest shape |
| `xema.scope` | Enforced boot/dependency tier: `kernel`, `system`, `base`, or `platform` |
| `xema.components[]` | Current v5 artifact and runtime declaration |
| `xema.dependencies` | Hard biome dependencies by id |
| `xema.agents[]` | Agent roster cross-validated with the Agent files |
| `xema.contributions` | Directory and/or inline typed contribution envelopes |
| `xema.requiresCapabilities` | Capabilities the biome may request; declaration is not a grant |
| `xema.exposesCapabilities` | Capabilities implemented by the biome |
| `xema.permissions` | Human-readable install-consent metadata |

The generated [Manifest Reference](./04-manifest-reference.md) is the field-by-field source of truth.

---

## Components

`xema.components[]` replaces the retired `ships.apis[]` model. A component can be content, web, adapter, service, worker, or job. Its `artifact.path` is the authoritative filesystem location.

Every component declares its runtime contract:

- tenancy and verified tenant context;
- minimum isolation and trust;
- permitted locality;
- stateless, ephemeral, or durable state requirements;
- resource and optional accelerator needs;
- runtime and version range;
- ingress, egress, raw-body, and device needs;
- scaling, concurrency, readiness, drain, and scheduling hints.

The host can therefore refuse an unsatisfied installation rather than starting a component under weaker conditions.

---

## Scope tiers and boundaries

Customer and third-party biomes use the `platform` scope. The lower `kernel`, `system`, and `base` scopes build Xema's own foundation.

Biomes do not import other biomes' implementation. They communicate through capabilities and published contracts. This is what keeps one domain release from becoming a source-level dependency of every other domain.

---

## Permissions

`requiresCapabilities` and permission hints describe install intent. They do not grant runtime authority.

Runtime invocation still evaluates:

- the acting subject and delegation;
- Agent arming;
- resource reach and ownership;
- Space and Execution Environment;
- policy, approvals, quotas, and placement obligations.

---

## Fresh-instance model

A biome is not synonymous with a prebuilt Xema application. A new customer can begin with the base platform and create only the integration and domain biomes it needs. Existing domain biomes demonstrate the extension model; they are not required dependencies of a fresh installation.

---

**Next**: [Authoring →](./02-authoring.md)
