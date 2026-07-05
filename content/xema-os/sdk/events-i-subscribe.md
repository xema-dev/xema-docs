# SDK — Events I Consume

A biome consumes platform events through the **backend service it ships**. The service registers a set of typed **consumed-event descriptors** with `@xemahq/events`; the platform's event hub delivers every matching CloudEvent to that service, and a decorated handler method processes it.

There is no manifest field that subscribes a biome to events. Event consumption is a property of running code — a biome with no shipped service consumes no events. If your biome needs to react to platform events, it [ships an API](./backend-i-ship.md) and registers consumers inside it.

---

## CloudEvents 1.0 envelope

Every platform event is a CloudEvents 1.0 message delivered over the platform's event transport. The envelope carries:

```
specversion = "1.0"
type        = "<domain>.<resource>.<verb>.v<major>"   e.g. "xema.store.install.created.v1"
source      = "<service-slug>"                          e.g. "xema-store-api"
id          = "<unique delivery id>"
time        = ISO-8601
subject     = "<resource ref>"                          e.g. "xema://store/biome/document-buddy@1.4.2"
orgid       = "<orgId>"                                 extension attribute
projectid   = "<projectId>"                             extension attribute (when applicable)
data        = { ... }                                   typed per the registered event descriptor
```

Event types are versioned in the `vN` suffix — same major-bump-only rule as [capabilities](../capabilities.md). A consumer registered for `xema.store.install.created.v1` keeps receiving v1 events even after a v2 type ships; to receive v2 the consumer registers the v2 descriptor.

The event registry is a closed set extended only by kernel PR; biomes never invent their own event types. They consume types other services publish.

---

## How a biome consumes an event

Consumption is three pieces of code inside the biome's shipped service:

1. **A descriptor** — declare the event you consume with `defineEvent` from `@xemahq/events`, giving its `type`, `source`, and a Zod schema for `data`. This is the runtime contract the transport validates delivered payloads against.
2. **A consumed-events registry** — collect the descriptors your service consumes into a `consumed-events.registry.ts` array. The service module registers this array so the event hub knows which types to deliver to this service.
3. **A handler** — a NestJS provider method decorated with `@OnCloudEvent(<descriptor>)` that receives the validated envelope and does the work.

### 1. Declare the descriptor

```ts
// src/events/consumed/consumed-events.registry.ts
import { defineEvent, type EventSource, VisibilityTier } from '@xemahq/events';
import { z } from 'zod';

const STORE_SOURCE: EventSource = '/services/xema-store-api';

export const StoreInstallCreatedConsumed = defineEvent({
  type: 'xema.store.install.created.v1',
  source: STORE_SOURCE,
  schemaVersion: '1.0.0',
  visibility: VisibilityTier.INTERNAL,
  description: 'Store install created — refresh the biome cache for the org.',
  data: z.object({
    biomeRef: z.string(),
    orgId: z.string(),
  }),
  hint: z.object({ orgId: z.string() }),
});

export const MY_BIOME_CONSUMED_EVENT_DESCRIPTORS = [
  StoreInstallCreatedConsumed,
] as const;
```

### 2. Register the array in the service module

The service's `@xemahq/events` module registration takes the descriptor array so the event hub creates the subscription for exactly those types. An unknown or misspelled `type` never silently no-ops — the transport only delivers types that a registered descriptor declares.

### 3. Handle the delivered event

```ts
import { Injectable } from '@nestjs/common';
import { OnCloudEvent } from '@xemahq/events';

import { StoreInstallCreatedConsumed } from '../events/consumed/consumed-events.registry';

@Injectable()
export class StoreInstallConsumerService {
  @OnCloudEvent(StoreInstallCreatedConsumed)
  async onStoreInstallCreated(
    event: typeof StoreInstallCreatedConsumed.envelope,
  ): Promise<void> {
    // event.data.biomeRef / event.data.orgId — validated against the descriptor schema
    // event.orgid / event.projectid — envelope extension attributes
    await this.refreshCache(event.data.orgId);
  }
}
```

Rules:

- The handler runs inside the biome's own shipped service, under that service's identity and grants — every downstream call it makes is authorised exactly like any other call the service makes.
- The handler MUST be idempotent. The platform delivers events at-least-once; the deterministic CloudEvents `id` lets handlers dedupe.
- `data` is validated against the descriptor's Zod schema before your handler runs. A payload that fails the schema is a delivery error, not a silent skip.
- Long-running work belongs in a workflow run dispatched from the handler, not in the handler body.

---

## When a biome ships no service

A contributions-only biome — one that ships agents, skills, workflows, or connector bindings but no `ships.apis[]` service — does not consume platform events directly. If it needs event-driven behaviour, either:

- react to workflow lifecycle inside a [workflow definition](../../workflows/) (gates, follow-on jobs), or
- ship a small backend service ([Backend I ship](./backend-i-ship.md)) whose only job is to register consumers.

---

## Event types biomes commonly consume

(Closed set; this is a representative slice, not exhaustive.)

| Event type | Source | Typical use |
|---|---|---|
| `xema.store.install.created.v1` | `xema-store-api` | Cache invalidation, analytics, per-install provisioning |
| `workflow.run.completed.v1` | `workflow-engine-api` | Notify a chat channel, write a follow-up artifact |
| `workflow.run.failed.v1` | `workflow-engine-api` | Open an incident, trigger a remediation workflow |
| `agent-session.created.v1` | `agent-session-api` | Provision per-session resources (a temp KB space, a sandbox) |
| `agent-session.completed.v1` | `agent-session-api` | Capture transcripts to long-term memory |
| `connector.scm.pull-request.opened.v1` | connector gateway | Drive a review workflow |

The full registry is exposed via `xema concepts` and `xema concept event-type` in the Shell (see [Shell built-in commands](../shell.md#built-in-commands)).

---

## Related pages

- [Backend I ship](./backend-i-ship.md) — the service a biome needs before it can consume events
- [Capabilities](../capabilities.md) — how the calls a handler makes are authorised
- [Lifecycle Hooks](./lifecycle-hooks.md) — for transitions tied to a biome's own lifecycle (not platform events)

---

**Previous**: [← UI I contribute](./ui-i-contribute.md)
**Next**: [Testing →](./testing.md)
