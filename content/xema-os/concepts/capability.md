---
slug: capability
title: Capability
summary: A named, versioned, callable unit of platform behaviour. Every action in Xema — built-in or biome-contributed — is invoked through a capability ref of the shape `<owner>:<verb>@<version>`. Capabilities carry input/output schemas, a declared reach, default grants, and audit-trail policy.
relatedCommands: ["xema run shell:capability.explain@1"]
relatedCapabilities: ["shell:capability.explain@1"]
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

## Caller constraint

A descriptor may carry `callerConstraint: "workflow-step"`, which restricts the
capability to the [workflow](./workflow.md) steps of the installation that contributed
it. The router checks the constraint after agent exposure, using the target taken from
the sealed descriptor's HTTP binding; a constrained capability bound any other way is
refused.

A step proves it is the caller with a **step credential**: a short-lived token minted
for each call, scoped to the target's receiver audience and sent in the
`X-Xema-Workflow-Step-Credential` header alongside the caller's own bearer. The worker learns the
audience and the constraint from a router preflight that reads the sealed descriptor.
It caches that answer per run and pinned ref. The token is never reused across calls.

Calls that fail the constraint are refused with
`CAPABILITY_CALLER_CONSTRAINT_UNMET`: a caller that is not a workflow step, a run whose
workflow has no own installation, or a content-only biome (see
[workflow](./workflow.md)).
