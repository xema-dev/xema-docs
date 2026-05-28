---
slug: app
title: App
summary: A Layer-4 user-facing surface that composes one or more biomes plus optional product-specific UI and backend. An app is what end users see; biomes are the building blocks it consumes. Apps are addressable as `XemaObjectKind.App` and have their own client model for delegated access.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: stable
---

An app is the product layer of Xema, owned by `app-runtime-api`. It
picks a set of [biomes](./biome.md), wires them into a coherent UX,
and may add its own UI shell or backend service. Apps consume
[capabilities](./capability.md) through the same gateway that agents
and the shell use — there is no private back door. Apps may register
`app-client` records to support [delegated-session](./delegated-session.md)
flows where an external (non-Xema) caller acts on behalf of a Xema
[audience](./audience.md); the delegated JWT is RS256-signed in
production and carries `{ sub, act, org, project, session, environment,
capabilities, exp }`. The public ingress
(`app-runtime-public.xema.dev`) is split from the org-internal admin
ingress so platform AuthGuard is bypassed only on `/public/*` paths.
External-subject sessions are reachable through the embedded route
`/embedded/session/:token`. See the [Apps page](../apps.md) for the
full model, the endpoint surface, and the embed snippet.
