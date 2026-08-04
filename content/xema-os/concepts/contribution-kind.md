---
slug: contribution-kind
title: "Contribution Kind"
summary: "The closed catalog of things a biome may contribute through the contribution protocol, and — per kind — whether an ingestion parser actually consumes it today. Derived from the ContributionKind enum and the biome-host parser registry, so \"declared\" is never mistaken for \"supported\"."
relatedCommands: ["biome install","biome publish"]
relatedCapabilities: []
relatedZones: []
stability: stable
---

<!--
  AUTO-GENERATED — DO NOT EDIT BY HAND.
  Generator: tooling/codegen/generate-extension-surface-concepts.mjs
  Source of truth: ContributionKind (@xemahq/kernel-contracts/contribution)
  Source of truth: KIND_PARSERS (biome-host-api src/contributions/parsers/index.ts)
  Regenerate from the aggregator repo root:
    pnpm run docs:extension-surface
-->

A **contribution** is a typed envelope a biome ships:

```json
{
  "kind": "capability",
  "id": "my-contribution-slug",
  "manifest": { }
}
```

- `kind` — one of the values in the catalog below. Closed set; the wire values are a
  contract and are never renamed.
- `id` — kind-local slug, unique per `(kind, biome)`. The platform namespaces it with
  the biome id at install time.
- `manifest` — the kind-specific body, validated fail-fast against that kind's schema.

Two equivalent delivery forms, same envelope: one `*.contribution.json` file per entry
in the biome's contributions directory (default `./contributions`, overridable with
`xema.contributions.directory`), or an inline entry under `xema.contributions.inline[]`.

## Catalog

The **Ingestion** column is a fact, not a promise: it is derived from the parser
registry biome-host actually runs. A kind with no ingestion path silently does nothing
if you ship it as a contribution — use the delivery path named in its note instead.

| `kind` | Enum member | Ingestion | Note |
|---|---|---|---|
| `mount-source` | `ContributionKind.MountSource` | domain-service handler / self-registration (category 2) | Ingested by `@xemahq/biome-sdk`'s `MountSourceKindRegistry`, which each owning service self-registers its mount-source kinds into and which the workspace mount-resolver reads. |
| `workflow-step` | `ContributionKind.WorkflowStep` | biome-host parser (`WorkflowStepParser`) | — |
| `agent-skill` | `ContributionKind.AgentSkill` | biome-host parser (`AgentSkillParser`) | — |
| `agent-kernel` | `ContributionKind.AgentKernel` | biome-host parser (`AgentKernelParser`) | — |
| `model-resolution-dimension` | `ContributionKind.ModelResolutionDimension` | domain-service handler / self-registration (category 2) | Ingested by `llm-registry-api`'s `ModelStrategyBootstrapService` — a `BootstrapContributionsService` handler that loads the kernel-shipped `strategies/*.yaml` and upserts model-resolution strategies. |
| `widget-kind` | `ContributionKind.WidgetKind` | biome-host parser (`WidgetKindParser`) | — |
| `surface-kind` | `ContributionKind.SurfaceKind` | declared category 1 — parser NOT shipped yet, contributions are ignored | A VISTA SURFACE KIND contributed by a biome: the render kind a Vista preview tab can hold, declared as a bare biome-local slug plus a version, display name, summary, and an opaque JSON `payloadSchema`. |
| `artifact-type` | `ContributionKind.ArtifactType` | biome-host parser (`ArtifactTypeParser`) | An artifact type contributed by a biome to the artifact-store schema-version registry (`ArtifactTypeRegistryService`). |
| `inquiry-kind` | `ContributionKind.InquiryKind` | biome-host parser (`InquiryKindParser`) | An inquiry kind contributed by a biome to the inquiry-contracts `InquiryKindSchemaRegistry` (`kind-registry.ts`). |
| `role-capability` | `ContributionKind.RoleCapability` | biome-host parser (`RoleCapabilityParser`) | A role capability bundle contributed by a biome. |
| `biome-install-schema` | `ContributionKind.BiomeInstallSchema` | RESERVED — no contribution ingestion (category 3) | No parser, and none is wanted: the install-wizard resource-selection schema is an OPAQUE, browser-facing JSON Schema that biome-host-api serves on demand from the biome's convention `install-schema/` directory (`install.json` plus an optional `ui-schema.json`) via `GET /platform/biomes/server/:id/install-schema`. |
| `icon` | `ContributionKind.Icon` | RESERVED — no contribution ingestion (category 3) | No parser, and none is wanted: icons are BYTE ASSETS, not manifests — biome-host-api serves each one straight off disk from the biome's convention `icons/` directory via the public CDN-asset route `GET /platform/biomes/server/:id/icons/:slug.svg`, discovered by on-disk presence and never indexed. |
| `project-kit` | `ContributionKind.ProjectKit` | biome-host parser (`ProjectKitParser`) | A project-kit bundle contributed by a biome. |
| `provisioning-scaffold` | `ContributionKind.ProvisioningScaffold` | RESERVED — no contribution ingestion (category 3) | No parser: a provisioning scaffold is declared in the manifest's `xema.provisioning[]` and authored as `provisioning/<id>.yaml` plus an optional `provisioning/<id>/` template tree, and agent-session-api's `provisioning-plan-resolver` PULLS it over HTTP per session bootstrap from biome-host-api's `GET /platform/biomes/server/:id/provisioning-scaffolds`. |
| `connector-adapter` | `ContributionKind.ConnectorAdapter` | biome-host parser (`ConnectorAdapterParser`) | A concrete connector provider contributed by a biome inside an adapter kind. |
| `workflow-config` | `ContributionKind.WorkflowConfig` | biome-host parser (`WorkflowConfigParser`) | Workflow-config content shipped by a biome. |
| `deliverable-spec` | `ContributionKind.DeliverableSpec` | biome-host parser (`DeliverableSpecParser`) | A deliverable-spec contributed by a biome. |
| `workspace-manifest` | `ContributionKind.WorkspaceManifest` | biome-host parser (`WorkspaceManifestParser`) | A workspace manifest contributed by a biome. |
| `tool-profile` | `ContributionKind.ToolProfile` | biome-host parser (`ToolProfileParser`) | A tool-profile contributed by a biome. |
| `mcp-catalog` | `ContributionKind.McpCatalog` | biome-host parser (`McpCatalogParser`) | An MCP catalog entry contributed by a biome — a catalog manifest naming a connectable MCP service and the tools it exposes. |
| `opencode-tool` | `ContributionKind.OpenCodeTool` | RESERVED — no contribution ingestion (category 3) | No parser, and one CANNOT be shipped without first closing the build-time gap tracked as H10 in `.claude/plans/canopy-universal-agent.md` §11.1, which carries the full, component-by-component write-down of what a runtime path would require; this note is the summary. |
| `opencode-plugin` | `ContributionKind.OpenCodePlugin` | RESERVED — no contribution ingestion (category 3) | No parser, and the contribution-registrar deliberately does NOT route this kind — its own unit test uses this member as the canonical "not routed" fixture. |
| `capability` | `ContributionKind.Capability` | biome-host parser (`CapabilityParser`) | A `CapabilityRef` descriptor contributed by a biome — title, summary, I/O schemas, risk tier, and approval flag. |
| `resource-ownership` | `ContributionKind.ResourceOwnership` | biome-host parser (`ResourceOwnershipParser`) | A resource-instance ownership/visibility declaration contributed by a biome — `resourceType` + `resourceId` + a `ResourceVisibilityPattern` + the owning subjects (and optional explicit shares). |
| `resource-definition` | `ContributionKind.ResourceDefinition` | declared category 1 — parser NOT shipped yet, contributions are ignored | A provider-neutral resource definition contributed by a biome: namespaced key, exact unit, measurement/aggregation semantics, bounded dimensions, supported limit kinds, and usage-export capability. |
| `stage-machine` | `ContributionKind.StageMachine` | biome-host parser (`StageMachineParser`) | A deterministic asset stage machine contributed by a domain biome to a stage-machine host (today: `mailops-api`). |
| `search-type` | `ContributionKind.SearchType` | biome-host parser (`SearchTypeParser`) | A search RESULT-TYPE declaration contributed by a biome — the `XemaObjectKind`/`docType` it covers, render/route hints (label, icon, deep-link template), the searchable-field set + embedding-eligibility default, and the authz mapping (`resourceType` + default `ResourceVisibilityPattern`). |
| `credential-strategy` | `ContributionKind.CredentialStrategy` | biome-host parser (`CredentialStrategyParser`) | A DECLARATIVE credential-mint strategy contributed by a connector biome — the open credential-kind key it registers, the projection SCHEME (`bearer` / `basic` / `header`), and the field/template selectors that map a custody-resolved credential into an outbound token. |
| `canonical-object-type` | `ContributionKind.CanonicalObjectType` | biome-host parser (`CanonicalObjectTypeParser`) | A CANONICAL BUSINESS-OBJECT TYPE in the shared enterprise Common Data Model — the system-agnostic counterpart to the closed platform `XemaObjectKind`. |
| `ingestion-source` | `ContributionKind.IngestionSource` | biome-host parser (`IngestionSourceParser`) | A PULL-BASED EXTERNAL DATA SOURCE a biome declares so the platform can materialize an external dataset into a local catalog on a cadence, with change-detection and provenance. |

## Kinds with no biome-host parser

Do not ship a contribution of these kinds expecting it to be picked up by
`biome-host-api`:

- `mount-source` — domain-service handler / self-registration (category 2)
- `model-resolution-dimension` — domain-service handler / self-registration (category 2)
- `surface-kind` — declared category 1 — parser NOT shipped yet, contributions are ignored
- `biome-install-schema` — RESERVED — no contribution ingestion (category 3)
- `icon` — RESERVED — no contribution ingestion (category 3)
- `provisioning-scaffold` — RESERVED — no contribution ingestion (category 3)
- `opencode-tool` — RESERVED — no contribution ingestion (category 3)
- `opencode-plugin` — RESERVED — no contribution ingestion (category 3)
- `resource-definition` — declared category 1 — parser NOT shipped yet, contributions are ignored

## Adding a kind

Adding a `ContributionKind` touches exactly two files in the kernel: the enum, and the
kind-specific manifest schema in the same package. The per-kind ingestion parser lives
in the consuming service (`biome-host-api`), not the kernel. Needing a third kernel
file is a layering smell.

A new member MUST arrive with a parser, or with an honest category annotation in its
doc comment. This page is generated from those annotations and the parser registry —
a parser-less member with no annotation fails the generator.

## Related concepts

- [extension-surface](./extension-surface.md) — the three extension channels
- [contribution](./contribution.md) — what a contribution is, conceptually
- [capability-contribution](./capability-contribution.md) — the `capability` kind's manifest
- [surface-contribution](./surface-contribution.md) — the `surface-kind` kind's manifest
- [search-type-contribution](./search-type-contribution.md) — the `search-type` kind's manifest
