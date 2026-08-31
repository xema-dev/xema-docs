# Developer Annotations

Xema OS replaces handwritten route and capability manifests with **decorators that are the source of truth**. A developer writes a controller; convention inference classifies every route and derives its capability surface at boot, so the description of what a service exposes lives next to the code that exposes it.

Annotations describe **what exists**. They are not the access check — access is decided by capability grants and the policy decision point, documented on [Permissions & Access](./permissions.md). Keep that distinction in mind while reading: a decorator classifies a route, a guard fences it, and a grant authorizes the caller.

This page documents the decorator set, the convention-inference rules, and the escape hatches.

---

## The decorator set

All decorators live in `@xemahq/xema-decorators`. Import what you use; the rest stay out of your code.

### `@XemaResource(...)`

Declares the **resource** this controller serves. One per controller.

```ts
@XemaResource('invoice')
@Controller('orgs/:orgId/projects/:projectId/invoices')
export class InvoiceController { /* ... */ }
```

Long form when you need to be explicit:

```ts
@XemaResource({
  resource: 'invoice',
  spaceFrom: ProjectSpace.fromParam('projectId'),
  tags: ['finance'],
})
@Controller('orgs/:orgId/projects/:projectId/invoices')
export class InvoiceController { /* ... */ }
```

The resource name flows into every operationId, permission label, and capability ref derived under this controller.

### `@XemaRoute(...)`

Declares that a method is a Xema-managed route. Empty by default — the inference engine fills in the action, the operationId, and the permission label from the method name and the HTTP verb.

```ts
@XemaResource('invoice')
@Controller('orgs/:orgId/projects/:projectId/invoices')
export class InvoiceController {
  @XemaRoute()
  @Get(':id')
  read(@Param('id') id: string) { /* ... */ }
  // → action = 'read', operationId = 'invoice.read', label = 'invoice.read'

  @XemaRoute()
  @Get()
  list() { /* ... */ }
  // → action = 'list', operationId = 'invoice.list', label = 'invoice.list'

  @XemaRoute()
  @Post()
  create(@Body() body: CreateInvoiceDto) { /* ... */ }
  // → action = 'create', operationId = 'invoice.create', label = 'invoice.create'
}
```

Override when the convention doesn't fit:

```ts
@XemaRoute({ action: 'export', operationId: 'invoice.exportPdf', permission: 'invoice.export' })
@Get(':id/pdf')
exportPdf() { /* ... */ }
```

### `@XemaPublicRoute(...)`

Declares the route is intentionally reachable without an authenticated caller. You must say *why*, and `reason` is a closed set (`PublicRouteReason`) rather than free text — an unrecognised value throws at startup:

```ts
import { PublicRouteReason, XemaPublicRoute } from '@xemahq/xema-decorators';

@XemaPublicRoute({
  reason: PublicRouteReason.OpenApiSpec,
  rateLimit: { perMinute: 60 },
})
@Get('openapi.json')
getOpenapi() { /* ... */ }
```

Use `PublicRouteReason.Unspecified` only as a deliberate fallback — it requires a non-empty `notes` string. The reason travels with the route's classification, so "which routes are open, and on what grounds" is answerable from the service's own generated description rather than from memory.

### `@XemaInternalRoute(...)`

Classifies a route as service-to-service — an internal audience rather than a browser-facing one. `audience` is a single value from a closed set: `service`, `admin`, or `worker`.

```ts
import {
  InternalRouteAudience,
  XemaInternalRoute,
} from '@xemahq/xema-decorators';
import { ServiceActorGuard } from '@xemahq/platform-common';

@UseGuards(ServiceActorGuard)
@Controller('hooks')
export class RunHooksController {
  @XemaInternalRoute({ audience: InternalRouteAudience.Service })
  @Post('run-finished')
  handleRunFinished() { /* ... */ }
}
```

**The decorator classifies; the guard enforces.** This is the single most important thing to get right on this page. `@XemaInternalRoute` records an audience — it keeps the route out of the public client bundle and states who it is meant for. It installs no runtime check of its own, and nothing derives an admission decision from the `audience` value. A route that must refuse external callers says so with an explicit guard (`ServiceActorGuard`, or `ServiceTokenGuard` for a shared-secret caller), exactly as above.

Omitting the guard leaves the route mounted and reachable by any caller the service's ambient authentication already admits. Classification is not a fence; treat the two as separate obligations and satisfy both.

### `@XemaIgnoreRoute(...)`

Declares the route is **not** Xema-managed. You must say why — this is the escape hatch for legacy endpoints during migration:

```ts
@XemaIgnoreRoute({ reason: 'Legacy health endpoint — to be deleted after Phase X' })
@Get('healthz')
health() { /* ... */ }
```

### `@XemaCapability(...)` / `@XemaCapabilities(...)`

Declares that a method exposes a **capability** — the invocation surface other biomes and agents call through the capability router.

```ts
@XemaCapabilities({ resource: 'invoice', version: '1', spaceFrom: ProjectSpace.fromParam('projectId') })
@Controller(...)
export class InvoiceCapabilityController {
  @XemaCapability()         // ref defaults to 'invoice.extract@1'
  @Post('extract')
  extract(@Body() input: ExtractInput) { /* ... */ }

  @XemaCapability('invoice.send-reminder@1')   // explicit ref
  @Post('send-reminder')
  sendReminder() { /* ... */ }
}
```

---

## Space-from helpers

Every protected resource is anchored to a [Space](./spaces.md). The `spaceFrom` field of `@XemaResource` and `@XemaCapability` says how to compute the SpaceRef from the inbound request:

```ts
import {
  InputSpace,
  ProjectSpace,
  RequestSpace,
  SpaceFromKind,
} from '@xemahq/xema-decorators';

ProjectSpace.fromParam('projectId')      // URL param
ProjectSpace.fromStatic('xema://org/acme')  // fixed SpaceRef
RequestSpace.fromHeader('x-xema-org-id') // request header
InputSpace.fromField('projectId')        // body field
```

These helpers are convenience constructors over one closed union, `SpaceFromSpec`, whose `kind` is `param`, `field`, `header`, or `static`. Adding a fifth kind is a platform change, because the runtime resolver has to know how to interpret it — so declare the spec, rather than writing a resolver of your own.

---

## The convention dictionary — action inference

When `@XemaRoute()` is empty, the inference engine picks an action from a **closed dictionary** matched against the method name:

| Method name pattern | Inferred action |
|---|---|
| `get`, `read`, `fetch`, `show`, `find` (single) | `read` |
| `list`, `index`, `search`, `findAll` | `list` |
| `create`, `add`, `post`, `new` | `create` |
| `update`, `patch`, `edit`, `modify` | `update` |
| `replace`, `put`, `set` | `replace` |
| `delete`, `remove`, `destroy` | `delete` |
| `export`, `download` | `export` |
| `approve` / `reject` | `approve` / `reject` |
| `send`, `notify`, `dispatch` | `send` |
| `run`, `execute`, `trigger` | `run` |
| `extract`, `parse`, `analyze` | `extract` |

If none match, startup fails with a clear diagnostic:

```
[XemaRuntime] Controller InvoiceController method 'crunchNumbers':
  Unable to infer action from method name.
  Fix options:
    • Rename the method to one of: read, list, create, ...
    • Add an explicit action: @XemaRoute({ action: 'crunch' })
    • Mark as ignored: @XemaIgnoreRoute({ reason: '...' })
```

The dictionary is intentionally small and closed. It grows only through a kernel PR — never by org or biome opt-in — so the meaning of a verb stays uniform across the entire OS.

---

## OperationId and permission-label inference

By default, both the OpenAPI `operationId` and the route's **permission label** are `<resource>.<action>` — e.g. `invoice.read`. The `operationId` falls back to `<resource>.<methodName>` when action inference does not yield a verb.

The two serve different purposes, and only the first is load-bearing:

- **`operationId` identifies the operation.** It names the method on the generated client, so it has to be unique and it is stable across regenerations. Treat it as part of your API contract.
- **`permission` is a descriptive label**, not an access check. It is a coarse grouping of related operations — deliberately non-unique, so that several endpoints doing the same conceptual thing carry the same label. It is emitted onto the generated specification as `x-xema-permission` and is useful for grouping and reporting.

**A permission label authorizes nothing.** Nothing in the request path reads it, and two operations sharing a label are not thereby equivalent for access purposes. What decides whether a caller may proceed is a capability grant evaluated by the policy decision point — see [How access is actually decided](#how-access-is-actually-decided) below.

Override the label when routes that share an action should group together:

```ts
@XemaRoute({ permission: 'invoice.export' })
@Get(':id/pdf')
exportPdf() {}

@XemaRoute({ permission: 'invoice.export' })
@Get(':id/csv')
exportCsv() {}
```

Both routes carry the label `invoice.export`; their operationIds stay distinct (`invoice.exportPdf` + `invoice.exportCsv`) because the inference engine uses method names there.

---

## Boot-time discovery — `XemaRuntimeModule.forService`

The decorator surface needs one wiring point per service:

```ts
import { XemaRuntimeModule } from '@xemahq/xema-decorators';

@Module({
  imports: [
    XemaRuntimeModule.forService({
      serviceName: 'invoice-api',
      serviceKind:  'biome-api',       // 'platform-service' | 'biome-api' | 'cli'
      discovery:    'decorators',      // or 'manual' where decorator scanning is unavailable
      policy:       'fail-closed',     // or 'fail-open' (dev only)
    }),
  ],
})
export class AppModule {}
```

At boot the module:

1. Scans every controller for the decorators above.
2. **Fail-closed startup**: any unclassified route is a startup error. The error message lists fix options.
3. Writes `routes`, `capabilities`, and `service` manifests to a temporary directory as **startup diagnostics** — a snapshot of what this process classified, useful when a startup error needs explaining. They are not part of the image, they are not read back, and nothing downstream consumes them. Override the location with `manifestOutputDir` if the default is not writable.
4. Optionally publishes the service's fully-described capabilities to the capability registry, when the service opts in with `registerCapabilities: true`. That publish is the authoritative one, and it is complete-set: a capability the service stops declaring is withdrawn on the next boot.

The durable description of a service's routes is its **generated OpenAPI document**, which carries the classification for every operation. That is what clients and tooling read.

`fail-open` exists only for local development. `XemaRuntimeModule.forService` refuses it outright under a production environment and throws at construction, so a service cannot start in a cluster with unclassified routes tolerated.

---

## How access is actually decided

Developers define **what exists**. Admins decide **who can do it** — and the unit they work with is the **[capability](./capabilities.md) ref**, not the permission label above.

A capability ref (`billing:invoice.read@1`) names one specific action. Everything an admin does is expressed against those refs:

| Admin action | What it is |
|---|---|
| **Grant** | "This subject may use this capability, in this [environment](./environments.md)." The one thing the verdict checks. |
| **Role** | A reusable bundle of grants. Grant the bundle once, hand it to people. |
| **Team** | A group of subjects, with nesting. Assign a role to a team and every member — and every sub-team — inherits it. |

Each grant carries its own posture: the environment it applies in, optional constraints (call-rate and cost ceilings), and whether an invocation needs a named human approver before it proceeds. Those are properties of the grant, so the same capability can be routine in one environment and approval-gated in another without the developer changing anything.

At request time a single policy decision composes the verdict — grant, delegation clamp, agent reach tier, resource ownership, credential binding — and returns `allow`, `deny`, or `needs_approval`, fail-closed. The full contract is on the [Policy](./policy.md) page; the model as a whole, including how an agent's ceiling interacts with its owner's authority, is on [Permissions & Access](./permissions.md).

The admin never edits the developer's annotations. The developer never edits the admin's policy.

---

## What this replaces

Before annotations, a service described itself in hand-maintained side files — a route list, a capability list — kept in step with the controllers by whoever remembered. They drifted, and the drift was invisible until something downstream broke.

After annotations:

- The description is **derived from the code**, on every boot. There is no side file to update and none to forget.
- A new endpoint is a one-line addition (`@XemaRoute() @Get(':id') read() {}`), and its action, operationId, permission label, and space resolver all follow from it.
- An unclassified route is a startup error rather than a silent omission, so a surface cannot ship undescribed.
- The single source of truth lives next to the code it describes.

What annotations do **not** replace is the access decision. Classifying a route says what it is; a guard says who may reach it, and a grant says who may act. Those remain explicit.

---

## Related concepts

- [Permissions & Access](./permissions.md) — how access is actually decided, end to end.
- [Capabilities](./capabilities.md) — the invocation surface `@XemaCapability` produces, and the unit every grant names.
- [Policy](./policy.md) — the verdict shape, obligations, and approval flow.
- [Environments](./environments.md) — the trust profile a grant is scoped to.
- [Spaces](./spaces.md) — `spaceFrom` resolves the SpaceRef for every request.
- [Service registry](./service-registry.md) — how a service announces itself to its peers.

---

**Previous**: [← MCP and Capabilities](./mcp-and-capabilities.md)
**Next**: [CLI →](./cli.md)
