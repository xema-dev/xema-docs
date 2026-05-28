---
slug: profile
title: Profile
summary: A named bundle of grants and configuration that can be attached to a subject (user, service account, agent) in one step. Profiles are how Xema avoids ad-hoc per-subject grant sprawl; they compose with audiences but are not the same thing.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: experimental
---

A profile is a reusable assignment unit: a set of
[permission](./permission.md) grants, default [environment-grants](./environment-grant.md),
and optional configuration that an org administrator attaches to a
subject. Compared to an [audience](./audience.md), which is a typed
*group* used for routing and bulk-targeting, a profile is a typed
*role* assigned to one subject at a time. Profiles compose with
audiences — a subject may be in multiple audiences and hold multiple
profiles. Profiles are first-class [objects](./object.md) of kind
`profile`. See plan §29 for the role/profile model.
