---
slug: store
title: Store
summary: Xema's canonical distribution surface for biomes. Published biomes live in the Store, addressable as `xema://store/biome/<id>@<version>`. Every listing, submission, approval, and install operation is one of the five `store:biome.*@1` capability calls, and submissions run only in the `store-review` execution environment.
relatedCommands: ["xema biome install", "xema biome publish"]
relatedCapabilities: ["store:biome.list@1", "store:biome.submit@1", "store:biome.approve@1", "store:biome.install@1", "store:biome.archive@1"]
relatedZones: ["store-review"]
stability: stable
---

The Store is Xema's distribution surface for [biomes](./biome.md),
owned by `xema-store-api`. Submitting a biome moves it into the
`store-review` [execution-environment](./execution-environment.md), where the
service validates the [manifest](./manifest.md), runs contribution
checks, and writes a `StoreListingVersion` row in lifecycle
`store-submitted`. Approval flips it to `store-approved`; rejection is
terminal. Installs read from the Store via the
`store:biome.install@1` [capability](./capability.md), which emits
the `xema.store.install.created.v1` CloudEvent for `biome-host-api`
to pick up — the same path whether the biome is first-party,
third-party, or private to an org. The Store is itself addressable in
[XVFS](./xvfs.md) at `xema://store/biome/<id>`. Pricing carries a
deferred `pricingPolicy` field on the listing — present in the schema
but not active in this phase. See the [Store page](../store.md) for
the full publish / install pipeline and the
[Publishing SDK page](../sdk/publishing.md) for the publisher-side
flow.
