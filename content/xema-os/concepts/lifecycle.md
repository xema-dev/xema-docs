---
slug: lifecycle
title: Object Lifecycle
summary: The closed `draft → published → archived` state machine every versioned XemaObject moves through. Only `published` versions can be resolved; `draft` is editor-only and `archived` is preserved for lineage. Lifecycle transitions are auditable and irreversible (no un-publish).
relatedCommands: ["xema inspect"]
relatedCapabilities: ["xema-shell:inspect@1"]
relatedZones: []
stability: stable
---

The lifecycle is the contract that lets Xema treat references
deterministically. A [draft](./draft-vs-published.md) version is
mutable and never resolves. A `published` version is immutable —
the only state the resolver returns. An `archived` version is kept
so [lockfiles](./lockfile.md) and historical references stay valid,
but the resolver refuses to return it for new lookups. The lifecycle
enum is shared by every versioned [object](./object.md) kind
([skill](./skill.md), [composition](./composition.md),
[workflow](./workflow.md), [biome](./biome.md), [agent](./agent.md))
so the publish / resolve contract is uniform.

[Biomes](./biome.md) extend this triad with their own seven-state
machine — `BiomeLifecycle` — which adds the install / promote / review
/ store stages on top of the universal triad:
`draft → sandbox-installed → review-required → org-installed →
store-submitted → store-approved → archived`. Every transition is a
capability call (`biome:install@1`, `biome:promote@1`,
`biome:submit-to-store@1`, `biome:approve-in-store@1`, `biome:archive@1`)
gated by the [capability](./capability.md) gateway and audited as one
decision. The full state machine lives in the
[Biomes overview](../biomes.md). See
`packages/kernel/xema-object-contracts/src/lib/object-lifecycle.ts` for
the universal triad and `packages/clients/biome-host-api/src/models/biomeLifecycle.ts`
for the biome-specific enum.
