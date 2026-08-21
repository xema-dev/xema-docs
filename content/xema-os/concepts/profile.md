---
slug: profile
title: Profile
summary: A PLANNED concept, not a shipped one. A named bundle of grants and configuration an org admin would attach to a subject in one step. Nothing in the platform implements it today — there is no profile object kind, no assignment table, and no lifecycle enum. Use explicit capability grants and roles.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: experimental
---

**Not implemented.** There is no `profile` object kind, no profile table, and
no assignment surface anywhere in the platform. This entry records a design
direction so it is not reinvented, not a capability you can use.

The idea: a reusable assignment unit — a set of [permission](./permission.md)
grants plus default [environment grants](./environment-grant.md) — that an org
administrator attaches to a subject in one step, instead of writing the same
twenty grants for every new hire.

It is deliberately distinct from an [audience](./audience.md), which is a typed
*group* used for routing and bulk targeting. A profile would be a typed *role*
held by one subject. The two answer different questions: "where does this event
fan out to?" versus "what can this subject do?".

Until it ships, the supported path is explicit capability grants, org roles and
team membership. See [permission](./permission.md).
