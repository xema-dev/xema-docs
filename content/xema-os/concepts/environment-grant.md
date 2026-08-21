---
slug: environment-grant
title: Environment Grant
summary: An explicit authorization that a subject (or audience, or profile) may execute capabilities in a specific execution environment. Environment grants are the other half of the capability authorization model — without one, a capability call cannot leave its required environment.
relatedCommands: ["xema run xema-shell:environment.explain@1"]
relatedCapabilities: ["xema-shell:environment.explain@1"]
relatedZones: ["system", "org", "sandbox", "store-review"]
stability: stable
---

An environment grant is a typed authorization row that says "subject S may
execute capabilities in environment E." `authorization-api` checks that the
caller holds an environment grant for the active
[execution environment](./execution-environment.md) before dispatching, and
the environment's reach ceiling then caps what the
[capability](./capability.md) may touch. Environment grants are revocable,
auditable, and can be issued at any scope tier
([object scope](./object.md)). They are the mechanism that lets Xema
trust biomes incrementally — a third-party biome may default to the
`sandbox` environment and require an explicit grant to run in `org` or
`project`.
