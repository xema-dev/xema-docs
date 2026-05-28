---
slug: draft-vs-published
title: Draft vs Published
summary: The defining distinction in the Xema lifecycle. Drafts are editor-only revisions — mutable, unresolvable, and never referenced by lockfiles. Publishing snapshots the draft into an immutable version that is the only state the resolver serves.
relatedCommands: []
relatedCapabilities: []
relatedZones: []
stability: stable
---

The draft/published split is what lets Xema offer fast iteration in
authoring tools without compromising determinism at runtime. While you
edit a [skill](./skill.md), a [composition](./composition.md), a
[workflow](./workflow.md), or a [biome](./biome.md), the active row is
a `draft` — mutable, never visible to consumers, and never written to
a [lockfile](./lockfile.md). Publishing freezes the draft into an
immutable version; from that moment, every consumer that resolves the
ref by `slug` gets that exact version. To change behaviour you publish
*another* version. There is no un-publish — that would silently change
live behaviour. The one exception across Xema OS is
[capability](./capability.md) refs, which auto-version like syscalls
(`@1`, `@2` coexist indefinitely); see the
[Versioning page](../versioning.md) for the full rule. See
[lifecycle](./lifecycle.md) and `.claude/rules/skills-and-composition.md`.
