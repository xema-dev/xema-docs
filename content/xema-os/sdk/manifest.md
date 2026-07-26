# SDK — Manifest Reference

The biome manifest is the single declarative entry point for a biome. It identifies the package, declares the contributions it ships, declares the capabilities it requires and exposes, and pins its supported platform versions.

> **Naming.** The manifest filename is `xema-biome.json` and the SDK package is `@xemahq/biome-host-sdk`. The current Xema OS shape uses `contributions`, `requiresCapabilities[]`, `exposesCapabilities[]`, `engines`, `permissions`, `lifecycle`, `ships`, and `storage`.

This page mirrors the runtime Zod schema. The schema is the source of truth; this doc is the human-readable view.

---

## Top-level

```jsonc
{
  "name":    "@your-scope/your-biome",   // npm package name (required, scoped)
  "version": "1.0.0",                    // semver (required)
  "xema":    { /* see below */ }         // platform metadata (required)
}
```

---

## The `xema` block

```jsonc
{
  "id":                   "your-biome",
  "name":                 "Your Biome",
  "version":              "1.0.0",
  "trustTier":            "verified-store",
  "space":                "third-party",
  "engines":              { "xema": "^1.0.0" },

  "contributions":        { ... },
  "requiresCapabilities": [ ... ],
  "exposesCapabilities":  [ ... ],
  "requires":             { ... },
  "permissions":          { ... },
  "lifecycle":            { ... },
  "ships":                { "apis": [ ... ] },
  "storage":              { ... }
}
```

### `id` (string, required)

Kebab-case (`^[a-z][a-z0-9-]*$`). Globally unique across the deployment. Every biome-scoped resource, action, and ref namespaces under this id.

### `name` (string, required)

The human-readable display name shown wherever the platform lists biomes. Free-form, short.

### `version` (string, required)

Semver. Same string as the package's `version`. Lockfiles pin exact versions; the platform enforces immutability of published versions.

### `trustTier` (enum, required at Phase 6; tolerated at 1A)

Closed set: `first-party | verified-store | org-private | unverified`. Drives default profile suggestions and Store visibility.

### `space` (enum, required)

`first-party | third-party`. Drives UI badges and audit signals. (Previously named `scope`.)

### `engines.xema` (semver range, required from Phase 1A)

Semver range that must be satisfied by the running platform version. The host refuses to install a biome whose engine constraint is not satisfied — fail-fast, no best-effort load.

```jsonc
"engines": { "xema": "^1.0.0" }
```

---

## `requiresCapabilities[]` (Phase 1A additive)

The capabilities the biome may invoke. The host refuses to enable a biome whose required capabilities cannot be satisfied by the install environment. Listed as capability refs.

```jsonc
"requiresCapabilities": [
  "kb:page.read@1",
  "kb:space.list@1",
  "connector:tracker.issue.create@1"
]
```

These feed Stage 1 of the permission model — the install-time digest the org admin reviews. See [Capabilities](../capabilities.md).

---

## `exposesCapabilities[]` (Phase 1A additive)

The capability refs the biome implements. The contribution registry indexes these so the gateway can route calls.

```jsonc
"exposesCapabilities": [
  "connector:scm.create-pull-request@1",
  "connector:scm.merge@1"
]
```

A biome may both require and expose capabilities — for instance, a connector biome exposes provider verbs while requiring `mcp-tool:invoke@1`.

---

## `contributions` (every typed object the biome ships)

The unified surface for everything a biome ships. Two equivalent forms:

```jsonc
// Form 1: point at a directory of *.contribution.json files
"contributions": {
  "directory": "./contributions"
}

// Form 2: inline the contributions in the manifest
"contributions": {
  "inline": [
    { "kind": "agent-definition",    "path": "./agents/greeter.agent.yaml" },
    { "kind": "workflow-definition", "path": "./workflows/escalation.workflow.yaml" },
    { "kind": "deliverable-spec",    "path": "./deliverable-specs/spec.json" },
    { "kind": "mount-source",        "module": "./dist/mount-sources/cve-feed.js" }
  ]
}

// Form 3: combine both — the merged set is the union
"contributions": {
  "directory": "./contributions",
  "inline": [ /* ... */ ]
}
```

The `kind` value is a `ContributionKind` enum — closed set, extended only by kernel PR. Adding a new kind is two files: one enum entry plus the Zod schema for its manifest. No new top-level directory, no new seeder. See [SDK / Contributions](./contributions.md) for authoring details.

---

## `requires` (dependency declarations)

The biome's hard dependencies on other biomes by id and semver range. The host refuses to enable a biome whose required dependencies are not installed.

```jsonc
"requires": {
  "biomes": [
    { "id": "software-dev", "version": "^2.0.0" }
  ]
}
```

---

## `permissions`

Per-capability metadata that powers the install-time digest. Each entry pairs a capability with a human-readable reason and a suggested resource scope. Optional capability **groups** let the install UI render "one toggle grants this whole group".

```jsonc
"permissions": {
  "capabilityHints": [
    {
      "capability": "kb:page.read@1",
      "reason": "Search the knowledge base when answering questions.",
      "suggestedResource": "xema://orgs/${orgId}/projects/${projectId}/kb/support-*",
      "riskTier": "low"
    }
  ],
  "groups": [
    { "name": "kb-read", "capabilities": ["kb:page.read@1", "kb:space.list@1"] }
  ]
}
```

The `defaultProfile` (e.g. `read-only-assistant`, `support-chatbot`, `connector-bridge`) is read from this block by the install UI to pre-select a permission template.

---

## `lifecycle` (Phase 6)

Optional hook modules invoked at biome lifecycle transitions. Each hook runs in the biome's own capability set — it cannot do anything the biome itself cannot do at runtime.

```jsonc
"lifecycle": {
  "onInstall":   "dist/hooks/on-install.js",
  "onUninstall": "dist/hooks/on-uninstall.js",
  "onUpgrade":   "dist/hooks/on-upgrade.js",
  "onEnable":    "dist/hooks/on-enable.js",
  "onDisable":   "dist/hooks/on-disable.js"
}
```

The kernel calls these at the corresponding `BiomeLifecycle` transitions inside the biome's owning environment.

---

## `ships`

The optional list of runtime artifacts the biome distributes beyond pure contributions — backend API services, frontend route bundles, controller modules.

```jsonc
"ships": {
  "apis": [
    { "name": "invoice-api", "path": "./api", "openapi": "./api/openapi.json" }
  ]
}
```

A biome may ship zero, one, or many backend services. Each gets its own Helm sub-chart, its own image, its own subdomain, and its own capability namespace.

---

## `storage` (Phase 6)

Declares biome-owned data collections that the platform's biome data plane will provision and scope-enforce. Each collection specifies field types, encrypted fields, indexes, and per-tenant isolation rules.

```jsonc
"storage": {
  "collections": [
    {
      "name": "ticket-cache",
      "fields": {
        "id":     { "type": "string", "primaryKey": true },
        "body":   { "type": "string", "encrypted": true },
        "status": { "type": "enum", "values": ["open", "closed"] }
      },
      "indexes": [{ "fields": ["status"] }],
      "scope": "project"
    }
  ]
}
```

The data plane enforces tenancy, encryption at rest, quotas, and a closed filter-grammar at runtime. Biomes never receive raw DB handles.

---

## See also

- [Contributions](./contributions.md) — authoring `*.contribution.json` files in the `contributions/` directory.
- [Capabilities](../capabilities.md) — the surface every `requiresCapabilities`/`exposesCapabilities` ref names.
- [Developer Annotations](../developer-annotations.md) — generate capability and route manifests from controllers.

---

**Previous**: [← Getting Started](./getting-started.md)
**Next**: [Contributions →](./contributions.md)
