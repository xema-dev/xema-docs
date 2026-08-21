---
slug: execution-environment
title: Execution Environment
summary: A named environment within which capabilities are permitted to run. An environment describes a trust boundary (system vs sandbox vs store-review), a data-classification ceiling, and how far outside itself a capability may reach. Every capability call is bound to exactly one environment.
relatedCommands: ["xema run xema-shell:environment.explain@1"]
relatedCapabilities: ["xema-shell:environment.explain@1"]
relatedZones: ["system", "org", "sandbox", "store-review"]
stability: stable
---

Execution environments are how Xema enforces what runs *where*. A caller
must hold an [environment-grant](./environment-grant.md) for the active
environment at invocation time, and the environment then caps how far the
[capability](./capability.md) may reach. There are nine built-in
environments — `system`, `org`, `project`, `app`, `session`, `sandbox`,
`public`, `store-review` and `trusted-dev` — and the set is closed
(`ExecutionEnvironmentKind` in `@xemahq/kernel-contracts`). The environment
is the second half of the authorization model: [permission](./permission.md)
asks *who* may call; the environment asks *where* the call may run and how
far it may reach. Invoke `xema-shell:environment.explain@1` to inspect the
resolved environment grants.
