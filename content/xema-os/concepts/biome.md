---
slug: biome
title: Biome
summary: The Layer-3 installable software bundle in Xema. A biome can ship agents, skills, tools, workflows, document templates, themes, deliverable specs, mount sources, artifact types, connector bindings, frontend slot contributions, optional backend services, migrations, and OS-level controllers — all declared through a single manifest.
relatedCommands: ["biome install", "biome publish", "biome uninstall"]
relatedCapabilities: ["biome:install@1", "biome:publish@1"]
relatedZones: ["org", "sandbox", "store-review"]
stability: stable
---

A biome is the unit of distribution and capability in Xema. Unlike a
traditional plugin, a biome can extend nearly every plane of the platform
at once via its [manifest](./manifest.md): registering agents and
[skills](./skill.md), publishing [contributions](./contribution.md),
mounting [controllers](./controller.md), shipping zero, one, or many
optional backend sidecar services through `ships.apis[]`, declaring
collections served by the shared biome data plane, and registering
lifecycle hooks for install / uninstall / upgrade / enable / disable.
Biomes are installed into an organization, versioned, locked, and
governed by [environment-grant](./environment-grant.md) rules. At install time the
kernel validates the manifest, computes the [lockfile](./lockfile.md),
and reconciles the biome's contributions into the
[Object Registry](./object.md). The full
[`BiomeLifecycle`](./lifecycle.md) state machine
(`draft → sandbox-installed → review-required → org-installed →
store-submitted → store-approved → archived`) gates every promotion
behind a capability call and a default `requiresApproval=true` rule.
See the [Biomes overview](../biomes.md) for the full state machine and
the [Manifest reference](../sdk/manifest.md) for the manifest grammar.
