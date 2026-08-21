---
slug: connector
title: Connector
summary: A typed integration point with an external system (GitHub, Slack, Jira, S3, …). Connectors are declared by biomes and bound to concrete credentials at one of the four spaces credentials own — `system`, `org`, `project` or `user` — many named connections per provider, exactly one default per owner. All inbound webhooks flow through `connector-gateway-api`.
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
the gateway, using the adapter surface in `@xemahq/biome-sdk` and the
contracts in `@xemahq/kernel-contracts/connector`. A connector binding is
what a [workflow](./workflow.md) or [agent](./agent.md) names when it
needs to talk to an external service on behalf of an org. See the
[Capabilities page](../capabilities.md#worked-example--connector-pilot)
for the end-to-end connector capability flow.
