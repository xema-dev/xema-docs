---
slug: permission
title: Permission
summary: The "may this subject invoke this capability?" half of Xema authorization. Permissions are issued through capability grants, scoped to subjects (users, audiences, service accounts), and resolved by `authorization-api` on every capability call.
relatedCommands: ["xema run xema-shell:audit.read@1"]
relatedCapabilities: ["xema-shell:audit.read@1"]
relatedZones: ["org"]
stability: stable
---

Permissions answer the *who* of a capability invocation; the
[execution-environment](./execution-environment.md) answers the *where*. A subject
holds permission to call a [capability](./capability.md) by virtue of
one or more `capability-grant` [objects](./object.md) — granted
directly, via an org role, or via team membership. Every denial is recorded by
`audit-log-api` and can be read back through the
`xema-shell:audit.read@1` capability. Permissions are immutable per grant; revocation produces a
new grant with a `revoked` state — no in-place mutation.
