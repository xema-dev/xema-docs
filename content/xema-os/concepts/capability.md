---
slug: capability
title: Capability
summary: A named, versioned, callable unit of platform behaviour. Every action in Xema — built-in or biome-contributed — is invoked through a capability ref of the shape `<owner>:<verb>@<version>`. Capabilities carry input/output schemas, a declared reach, default grants, and audit-trail policy.
relatedCommands: ["xema run xema-shell:capability.explain@1"]
relatedCapabilities: ["xema-shell:capability.explain@1"]
relatedZones: []
stability: stable
---

A capability is the smallest atom of authority in Xema. It is the only
way an [agent](./agent.md), [app](./app.md), or human caller can do
anything observable on the platform. The capability gateway resolves the
ref, checks the caller's [permission](./permission.md) and required
[execution-environment](./execution-environment.md), then dispatches to the owning
controller or handler. Closed-domain enums make refs cheap to validate,
and the `outputSchema` makes the agent-facing surface deterministic
(see [xema-shell](./xema-shell.md)). Capabilities are first-class
[objects](./object.md) of kind `capability` — they appear in
[XVFS](./xvfs.md) at `/system/capability/<owner>/<verb>` and can be
read, listed, and audited.
