---
slug: manifest-extension-points
title: "Manifest Extension Points"
summary: "The parts of xema-biome.json that decide what a biome extends: the target discriminator, the declared contribution roster, and the contributions block that points at the envelopes. The full field-by-field reference lives in the biome authoring docs; this is the extension-relevant subset."
relatedCommands: ["biome install","biome publish"]
relatedCapabilities: []
relatedZones: []
stability: stable
---

<!--
  AUTO-GENERATED — DO NOT EDIT BY HAND.
  Generator: tooling/codegen/generate-extension-surface-concepts.mjs
  Source of truth: BiomeManifestSchema (@xemahq/kernel-contracts/biome)
  Regenerate from the aggregator repo root:
    pnpm run docs:extension-surface
-->

`xema-biome.json` is the biome contract. This page covers only the extension-relevant
parts — the complete field-by-field reference is
[Biomes → Manifest Reference](../../biomes/04-manifest-reference.md), generated from the
same schema.

## Top-level shape

The manifest tolerates extra top-level fields (it doubles as an npm
`package.json`-adjacent file) but validates these:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | pattern `/^@[^/]+\/[^/]+$/` |
| `version` | string | yes | — |
| `xema` | object (discriminated on `target`) — see **xema.target: "server"**, **xema.target: "web"** | yes | — |

Everything under `xema` is discriminated on `xema.target`.

## `xema.contributes`

The roster of contribution kinds this biome declares. Values come from the closed
[contribution-kind](./contribution-kind.md) catalog.

Array of `ContributionKind` (29 legal values).

## `xema.contributions`

| Field | Type | Required | Notes |
|---|---|---|---|
| `directory` | string | no | — |
| `inline` | array of objects — see **xema.contributions.inline[]** | no | — |

### `xema.contributions.inline[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | enum | yes | one of: `mount-source`, `workflow-step`, `agent-skill`, `agent-kernel`, `model-resolution-dimension`, `widget-kind`, `surface-kind`, `artifact-type`, `inquiry-kind`, `role-capability`, `biome-install-schema`, `icon`, `project-kit`, `provisioning-scaffold`, `connector-adapter`, `workflow-config`, `deliverable-spec`, `workspace-manifest`, `tool-profile`, `mcp-catalog`, `opencode-tool`, `opencode-plugin`, `capability`, `resource-ownership`, `stage-machine`, `search-type`, `credential-strategy`, `canonical-object-type`, `ingestion-source` |
| `id` | string | yes | pattern `/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/` |
| `manifest` | unknown (free-form JSON) | yes | — |

## Field rosters by target

### `xema.target: "server"`

- **Required (4)**: `id`, `displayName`, `scope`, `target`
- **Optional (34)**: `description`, `display`, `tags`, `capabilityDomain`, `runtimeRequirements`, `dependencies`, `extends`, `ships`, `capabilities`, `trustTier`, `connectorRequirements`, `webhookFilters`, `mcpWorkflowTools`, `mcpTools`, `defaultToolSelection`, `agents`, `provisioning`, `database`, `signature`, `bundleSource`, `signedBy`, `requires`, `contributes`, `contributions`, `requiresCapabilities`, `exposesCapabilities`, `ownsCapabilityDomains`, `permissions`, `lifecycle`, `engines`, `mandatory`, `audience`, `storeListed`, `kind`

### `xema.target: "web"`

- **Required (4)**: `id`, `displayName`, `scope`, `target`
- **Optional (23)**: `description`, `display`, `tags`, `systemSurface`, `requiresServerBiomes`, `optionalServerBiomes`, `capabilities`, `signature`, `bundleSource`, `signedBy`, `requires`, `contributes`, `contributions`, `requiresCapabilities`, `exposesCapabilities`, `ownsCapabilityDomains`, `permissions`, `lifecycle`, `engines`, `mandatory`, `audience`, `storeListed`, `kind`

Field types, constraints, and semantics for every name above are in
[Biomes → Manifest Reference](../../biomes/04-manifest-reference.md).

## Related concepts

- [manifest](./manifest.md) — the concept
- [biome](./biome.md) — the unit the manifest describes
- [contribution-kind](./contribution-kind.md) — what `contributes` may name
- [lockfile](./lockfile.md) — how contributions are pinned at install
