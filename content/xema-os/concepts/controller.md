---
slug: controller
title: Controller
summary: An OS-level reconciliation loop that owns one or more XemaObject kinds. Controllers watch projections, drive lifecycle transitions, and emit follow-up events. Most platform services expose at least one controller; biomes may ship their own through manifest declarations.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["host", "org"]
stability: stable
---

A controller is Xema's equivalent of a Kubernetes controller: a
deterministic loop that takes the *current* state of a set of
[objects](./object.md) and drives it toward the *desired* state.
Controllers are how the platform stays consistent under concurrent
writes and partial failures — they reconcile, they don't fire-and-
forget. Controllers may be shipped by platform services (`apps/`) or
by biome [manifests](./manifest.md) via the `controller`
[contribution](./contribution.md) kind. Each controller declares the
kinds it watches, the events it emits, and the [environment](./execution-environment.md)
it runs in.
