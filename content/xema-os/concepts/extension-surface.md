---
slug: extension-surface
title: "Extension Surface"
summary: "The complete, machine-readable set of ways a biome extends Xema: the contribution protocol (typed envelopes validated by kernel schemas), the convention content directories (on-disk presence), and the biome manifest itself. Every page in this set is generated from the kernel contract it documents, so it cannot drift from what the platform validates."
relatedCommands: ["xema biome install","xema biome publish"]
relatedCapabilities: []
relatedZones: []
stability: stable
---

<!--
  AUTO-GENERATED — DO NOT EDIT BY HAND.
  Generator: tooling/codegen/generate-extension-surface-concepts.mjs
  Source of truth: the kernel contract schemas in @xemahq/kernel-contracts
  Source of truth: KIND_PARSERS in biome-host-api
  Regenerate from the aggregator repo root:
    pnpm run docs:extension-surface
-->

Xema is extended by [biomes](./biome.md). A biome adds capability through exactly
three declared channels — there is no fourth, and none of them is code the platform
loads implicitly:

1. **The contribution protocol** — typed, single-file envelopes
   (`{ kind, id, manifest }`) that a biome ships in its contributions directory or
   inline in its manifest. Each `kind` has a kernel-owned or host-owned manifest
   schema and is validated fail-fast at biome-discovery time. See
   [contribution-kind](./contribution-kind.md).
2. **Convention content directories** — content discovered by on-disk presence. No
   declaration list; drop the files in the conventional directory and the platform
   seeds them at boot/install. The authoritative directory table is in
   [Biomes → Manifest Reference](../../biomes/04-manifest-reference.md).
3. **The manifest** — `xema-biome.json`, the biome's identity, target, dependency,
   and capability declaration. See [manifest-extension-points](./manifest-extension-points.md).

## The state of the contribution protocol

The public contract declares **29** contribution kinds.
**24** are ingested today by a `biome-host-api` parser;
**5** are not — they are either handled by a domain service
directly, or reserved for protocol completeness with a different (content-directory)
delivery path. Shipping a contribution of a kind with no ingestion path is a silent
no-op, which is why the catalog states the fact per kind rather than implying
uniform support.

## Contract areas

| Area | Concept | Kernel contract |
|---|---|---|
| What can be contributed | [contribution-kind](./contribution-kind.md) | `ContributionKind` |
| An agent-invocable capability | [capability-contribution](./capability-contribution.md) | `CapabilitySyncManifestSchema` |
| A Vista render surface | [surface-contribution](./surface-contribution.md) | `SurfaceContributionManifestSchema` |
| A search result-type | [search-type-contribution](./search-type-contribution.md) | `SearchTypeContributionManifestSchema` |
| The manifest itself | [manifest-extension-points](./manifest-extension-points.md) | `BiomeManifestSchema` |

## Related concepts

- [contribution](./contribution.md) — what a contribution is, conceptually
- [biome](./biome.md) — the unit that ships contributions
- [manifest](./manifest.md) — the `xema-biome.json` contract
- [capability](./capability.md) — the call surface every contribution ultimately reaches
- [object](./object.md) — how a contributed thing becomes addressable
