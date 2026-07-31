---
slug: capability-contribution
title: "Capability Contribution"
summary: "The manifest a biome ships to register an agent-invocable capability: ref, title, summary, side effects, I/O JSON Schemas, risk tier, and approval flag. One wire shape for both authoring paths — a contribution file and the @XemaCapability decorator both end on the same sync endpoint."
relatedCommands: ["biome install","biome publish"]
relatedCapabilities: []
relatedZones: []
stability: stable
---

<!--
  AUTO-GENERATED — DO NOT EDIT BY HAND.
  Generator: tooling/codegen/generate-extension-surface-concepts.mjs
  Source of truth: CapabilityContributionManifestSchema (@xemahq/kernel-contracts/capability)
  Source of truth: CapabilitySyncManifestSchema (@xemahq/kernel-contracts/capability-projection)
  Regenerate from the aggregator repo root:
    pnpm run docs:extension-surface
-->

Contribution kind: `capability`. Ingestion: biome-host parser (`CapabilityParser`).

A **capability** is the only way an agent reaches a side effect. Contributing one
declares WHAT it is; the platform decides who may call it. Two authoring paths produce
the identical wire payload and reach the identical endpoint, so the choice is purely
ergonomic:

1. **Contribution file** — `contributions/<slug>.capability.contribution.json`
   with `{ "kind": "capability", "manifest": { … } }`, or the equivalent
   `xema.contributions.inline[]` entry. No codegen step.
2. **Decorator** — annotate a NestJS provider method with the full `@XemaCapability`
   option set and opt the service into the boot-time registration scanner. A partial
   descriptor is skipped, never silently defaulted.

Provenance (`biome.id` / `biome.version`) is NOT a field below — the ingestion pipeline
stamps it from the discovering biome's manifest. Authors never declare it inline.

## `manifest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `ref` | string | yes | pattern `/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*@\d+$/` |
| `title` | string | yes | max 200 chars |
| `summary` | string | yes | max 1000 chars |
| `sideEffects` | string | yes | max 1000 chars |
| `inputSchema` | map<string, unknown (free-form JSON)> | yes | — |
| `outputSchema` | map<string, unknown (free-form JSON)> | yes | — |
| `riskTier` | enum | yes | one of: `low`, `medium`, `high`, `critical` |
| `requiresApproval` | boolean | yes | — |
| `examples` | map<string, unknown (free-form JSON)>[] | no | max 20 entries |
| `externalServiceRef` | string | no | max 200 chars |
| `defaultCredentialBindingRef` | string | no | max 200 chars |
| `outputClassification` | enum | no | one of: `public`, `internal`, `confidential`, `secret`, `regulated` |
| `authorityEffect` | enum | no | one of: `none`, `expanding` |
| `reach` | enum | no | one of: `owner`, `integration`, `platform` |
| `trustedContextProjection` | object — see **trustedContextProjection** | no | — |

### `trustedContextProjection`

| Field | Type | Required | Notes |
|---|---|---|---|
| `schemaVersion` | literal 1 | yes | — |
| `profile` | enum | yes | one of: `critical-operation-v1` |
| `delivery` | literal "server-envelope" | yes | — |

## Publish-time envelope

The parser and the decorator scanner both validate the manifest above **plus** the
invocation half, as one `CapabilitySyncManifest`. WHAT the capability is and HOW it is
invoked are split across kernel subpaths to keep the subpath graph acyclic; they are
recomposed here:

- `invocation` — optional.

An optional `invocation` is not a soft default. A capability must be reachable by
exactly one of: a declared invocation binding, an org-level provider binding, or a
live runner. A ref with none of the three fails fast at the capability router rather
than degrading.

## Related concepts

- [capability](./capability.md) — the concept
- [contribution-kind](./contribution-kind.md) — the full catalog
- [permission](./permission.md) — how a capability call is authorized
- [tool](./tool.md) — how a capability is exposed to an agent
