# SDK — Events I Subscribe

A biome wires itself to platform events through the manifest's `subscribes[]` block. Each entry binds a CloudEvents 1.0 event type to a handler module exported by the biome; the host (`biome-host-api`) registers the subscription with `event-hub-api` at install time, and the platform delivers matching events to the handler.

There is no imperative subscription API. The manifest is the source of truth — boot-time subscriptions never drift from the declared set.

---

## CloudEvents 1.0 envelope

Every platform event is a CloudEvents 1.0 message delivered over the platform's transport. The envelope carries:

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

Event types are versioned in the `vN` suffix — same major-bump-only rule as [capabilities](../capabilities.md). A subscriber that subscribes to `xema.store.install.created.v1` keeps receiving v1 events even after a v2 type ships; the subscriber must update its `subscribes[]` to receive v2.

The event registry is a closed set extended only by kernel PR; biomes never invent their own event types. They subscribe to types other services publish.

---

## The `subscribes[]` block

```jsonc
{
  "xema": {
    "subscribes": [
      {
        "type": "workflow.run.completed.v1",
        "handler": "./dist/handlers/on-run-completed.js"
      },
      {
        "type": "xema.store.install.created.v1",
        "handler": "./dist/handlers/on-store-install.js",
        "filter": {
          "biomeRef": "xema://store/biome/${biomeId}@*"
        }
      }
    ]
  }
}
```

| Field | Required | Purpose |
|---|---|---|
| `type` | yes | The CloudEvents `type` to subscribe to (closed set, kernel-registered) |
| `handler` | yes | Module path relative to the biome root |
| `filter` | optional | Per-attribute equality / glob filter applied by `event-hub-api` before delivery |

The host validates the `type` against the registered event descriptors at manifest-parse time. An unknown type is a fail-fast install error.

---

## Handler module shape

A handler module exports an async function that takes the typed event envelope and a context:

```ts
// dist/handlers/on-run-completed.js
import type {
  EventHandlerContext,
  WorkflowRunCompletedEvent,
} from '@xemahq/biome-host-sdk';

export default async function onRunCompleted(
  event: WorkflowRunCompletedEvent,
  ctx: EventHandlerContext,
): Promise<void> {
  // event.data.workflowRunId
  // event.data.outcome
  // event.orgid, event.projectid

  await ctx.callCapability('connector:chat.send-message@1', {
    channel: 'team-engineering',
    text: `Run ${event.data.workflowRunId} finished: ${event.data.outcome}`,
  });
}
```

Rules:

- The handler runs under the biome's installation subject and `BiomeInstallGrant` — every `ctx.callCapability(...)` invocation goes through `xema-capability-router` and is authorised exactly like any other biome call.
- The handler MUST be idempotent. The platform delivers events at-least-once; the deterministic CloudEvents `id` lets handlers dedupe.
- The handler runs in the same execution environment the biome itself runs in for the installation that owns the subscription.
- Synchronous handlers must complete within the per-handler timeout (configurable per biome, default 30s). Long-running work belongs in a workflow run, dispatched from the handler.

---

## Filtering

The optional `filter` block is an attribute-level match that `event-hub-api` evaluates before delivering. Supported predicates:

| Form | Meaning |
|---|---|
| `"key": "literal"` | Equality against the event's top-level attribute or `data.<key>` |
| `"key": "prefix*"` | Prefix glob |
| `"key": "${var}"` | Template — `var` is resolved against the biome's installation context (`biomeId`, `orgId`, `projectId`) at install time |

Filters reduce delivery volume; they are not authorisation. Even a filtered event passes through the gateway check inside the handler when the handler invokes a capability.

---

## Event types biomes commonly subscribe to

(Closed set; this is a representative slice, not exhaustive.)

| Event type | Source | Typical use |
|---|---|---|
| `xema.store.install.created.v1` | `xema-store-api` | Biome that consumes Store events — e.g. cache invalidation, analytics |
| `workflow.run.completed.v1` | `workflow-engine-api` | Notify a chat channel, write a follow-up artifact |
| `workflow.run.failed.v1` | `workflow-engine-api` | Open an incident, trigger a remediation workflow |
| `agent-session.created.v1` | `agent-session-api` | Provision per-session resources (a temp KB space, a sandbox) |
| `agent-session.completed.v1` | `agent-session-api` | Capture transcripts to long-term memory |
| `connector.scm.pull-request.opened.v1` | connector gateway | Drive a review workflow |

The full registry is exposed via `xema concepts` and `xema concept event-type` in the Shell (see [Shell built-in commands](../shell.md#built-in-commands)).

---

## Capability requirements

Every capability the handler calls MUST appear in `requiresCapabilities[]`. The boundary check rejects handlers that reach for refs the biome did not declare. At runtime, the gateway denies any call to an undeclared ref — fail-fast, with a structured `auditId` resolvable via `xema why-denied`.

---

## Related pages

- [Manifest reference](./manifest.md) — the `subscribes` block
- [Capabilities](../capabilities.md) — how `ctx.callCapability` is authorised
- [Lifecycle Hooks](./lifecycle-hooks.md) — for transitions tied to a biome's own lifecycle (not platform events)
- [Backend I ship](./backend-i-ship.md) — when an event handler should become a full service

---

**Previous**: [← UI I contribute](./ui-i-contribute.md)
**Next**: [Testing →](./testing.md)
