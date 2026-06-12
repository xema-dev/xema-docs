---
slug: execution-environment
title: Execution Environment
summary: A named environment within which capabilities are permitted to run. Zones describe trust boundaries (host vs sandbox vs store-review), data-residency, network reachability, and which capabilities may execute. Every capability call is bound to exactly one environment.
relatedCommands: ["xema zones explain"]
relatedCapabilities: ["xema-shell:environment.explain@1"]
relatedZones: ["host", "org", "sandbox", "store-review"]
stability: stable
---

Execution zones are how Xema enforces what runs *where*. A
[capability](./capability.md) declares the zones it tolerates; a caller
must hold a [environment-grant](./environment-grant.md) for one of those zones at
invocation time. Built-in zones include `host` (trusted kernel plane),
`org` (tenant-scoped), `sandbox` (isolated, no external network),
and `store-review` (used by the biome publishing pipeline). Zones are
the second half of the authorization model: [permission](./permission.md)
asks *who* may call, the environment asks *where* the call may run. Use
`xema zones explain` to inspect the resolved environment grants.
