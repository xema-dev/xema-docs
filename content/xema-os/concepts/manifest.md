---
slug: manifest
title: Manifest
summary: The single declarative document at the root of a biome (or biome-shipped service) that declares its identity, version, dependencies, contributions, required zones, and optional sidecar services. The manifest is the contract between the biome and the kernel.
relatedCommands: ["biome install", "biome publish"]
relatedCapabilities: ["biome:install@1", "biome:submit-to-store@1"]
relatedZones: ["store-review"]
stability: stable
---

The manifest is the only file a biome MUST author. It declares the
biome's identity, semver version, kernel-compatibility range, the set
of [contributions](./contribution.md) it ships, and any companion
[controllers](./controller.md) or sidecar services. The kernel
validates the manifest against `BiomeManifestSchema` in
`@xemahq/biome-contracts`, computes the [lockfile](./lockfile.md),
and reconciles each contribution into the [Object Registry](./object.md).
Manifests are immutable per version — to ship a change you publish a new
version. The optional `lifecycle` block declares the five hook fields
(`onInstall`, `onUninstall`, `onUpgrade`, `onEnable`, `onDisable`) that
`biome-host-api` invokes at the corresponding [BiomeLifecycle](./lifecycle.md)
transitions. See the [Manifest reference](../sdk/manifest.md) for every
field and `biome-host-api`'s OpenAPI spec for the publish / install
surface.
