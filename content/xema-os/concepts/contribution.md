---
slug: contribution
title: Contribution
summary: A typed declaration in a biome manifest of something the biome adds to the platform — a capability, a skill, a workflow, a shell command, an artifact type, a connector binding, and so on. Contributions are the only legal way a biome extends Xema; the kernel reconciles them at install.
relatedCommands: ["xema biome install", "xema biome publish"]
relatedCapabilities: ["biome:install@1"]
relatedZones: ["store-review"]
stability: stable
---

A contribution is one row in a biome's [manifest](./manifest.md). The
`ContributionKind` enum is closed (capability, shell-command, agent,
skill, tool, workflow, document-template, mount-source, …) and each
kind has a strict payload schema. At install time, the kernel writes
each contribution as a `contribution-entry` [object](./object.md) so
the platform always knows who declared what. Contributions are
self-describing: they declare required [capabilities](./capability.md),
[execution environments](./execution-environment.md), and any companion resources. They are
also the lockfile substrate — the [lockfile](./lockfile.md) pins exact
versions of every contribution at install time so subsequent boots are
deterministic.
