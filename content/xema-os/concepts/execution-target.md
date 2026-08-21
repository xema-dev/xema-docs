---
slug: execution-target
title: Execution Target
summary: The placement primitive — which pool of executors picks a workload up. A target is owned at a Space (`system` or `org`), carries operator-declared labels such as `region` and `residency`, and owns a task queue named after its own slug, so work placed on it executes nowhere else.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: experimental
---

An execution target answers one question: **which pool of executors
picks this workload up.** It is not a [runner](../runners.md) kind —
that says what sort of executor runs the work — and it is not a
[Space](./space.md) kind either, because ownership and placement are
different questions and the platform has already paid for fusing them
elsewhere.

Instead a target is *owned by* a Space. Its `ownerSpaceUri` is either
`xema://system` (the platform's own shared pool, `xema-managed`) or
`xema://orgs/<orgId>` — *"this workload runs THERE"*, said by a
customer. Those two tiers are the whole admissible subset: a target is
a physical pool with an enrolled worker behind it, so a
project-scoped or session-scoped one would be a pool nobody could
enrol into, and a [biome](./biome.md) declares what it *needs* from a
runtime and is forbidden from naming *where* it runs.

Everything ownership already knows how to do therefore comes free —
precedence between two targets at one slug is the same rank map, and
re-scoping is the same promotion rule.

A target's label map is open, and three keys have a reader: `region`,
`residency` and `accelerator`. `residency` is the one that matters
most, because it is what makes a data-residency claim enforceable: the
target has its own task queue (`<targetSlug>::<functional>`), polled
by the operator's own worker, on the operator's own hardware. Placement
is the queue name itself rather than a filter applied after the fact,
and every queue is qualified — there is no unqualified default that
work can fall into.
