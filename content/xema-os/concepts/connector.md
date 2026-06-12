---
slug: connector
title: Connector
summary: A typed integration point with an external system (GitHub, Slack, Jira, S3, …). Connectors are declared by biomes and bound per-org/per-project to concrete credentials. All inbound webhooks flow through `connector-gateway-api`; connector bindings carry the configuration.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: stable
---

A connector is the *type* of integration; a `connector-binding` is the
concrete instance with credentials and target. Connectors are
contributed by biomes and addressed as `XemaObjectKind.Connector`;
bindings are addressed as `XemaObjectKind.ConnectorBinding`. Inbound
webhooks always enter through `connector-gateway-api`; outbound calls go through
the shared `@xemahq/connector-sdks` package. A connector binding is
what a [workflow](./workflow.md) or [agent](./agent.md) names when it
needs to talk to an external service on behalf of an org. See the
[Capabilities page](../capabilities.md#worked-example--connector-pilot)
for the end-to-end connector capability flow.
