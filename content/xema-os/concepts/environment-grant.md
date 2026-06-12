---
slug: environment-grant
title: Environment Grant
summary: An explicit authorization that a subject (or audience, or profile) may execute capabilities in a specific execution environment. Environment grants are the other half of the capability authorization model — without one, a capability call cannot leave its required environment.
relatedCommands: ["xema zones explain"]
relatedCapabilities: ["xema-shell:environment.explain@1"]
relatedZones: ["host", "org", "sandbox", "store-review"]
stability: stable
---

A environment grant is a typed authorization row that says "subject S may
execute capabilities in environment Z." Every [capability](./capability.md)
declares the [execution environments](./execution-environment.md) it tolerates;
authorization-api checks that the caller holds a environment-grant for at
least one of them before dispatching. Environment grants are revocable,
auditable, and can be issued at any scope tier
([object scope](./object.md)). They are the mechanism that lets Xema
trust biomes incrementally — a third-party biome may default to the
`sandbox` environment and require an explicit grant to run in `org`.
