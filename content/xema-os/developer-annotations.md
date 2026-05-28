# Developer Annotations

Xema OS replaces handwritten permission manifests, route manifests, and capability manifests with **NestJS decorators that are the source of truth**. A developer writes a controller; convention inference turns it into a registered set of permissions, capabilities, and route entries at boot. The admin manages policy around those generated entries; the developer writes minimal annotations.

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

The resource name flows into every generated permission and capability ref under this controller.

### `@XemaRoute(...)`

Declares that a method is a Xema-managed route. Empty by default — the inference engine fills in the action, the operationId, and the permission name from the method name and the HTTP verb.

```ts
@XemaResource('invoice')
@Controller('orgs/:orgId/projects/:projectId/invoices')
export class InvoiceController {
  @XemaRoute()
  @Get(':id')
  read(@Param('id') id: string) { /* ... */ }
  // → action = 'read', operationId = 'invoice.read', permission = 'invoice.read'

  @XemaRoute()
  @Get()
  list() { /* ... */ }
  // → action = 'list', operationId = 'invoice.list', permission = 'invoice.list'

  @XemaRoute()
  @Post()
  create(@Body() body: CreateInvoiceDto) { /* ... */ }
  // → action = 'create', operationId = 'invoice.create', permission = 'invoice.create'
}
```

Override when the convention doesn't fit:

```ts
@XemaRoute({ action: 'export', operationId: 'invoice.exportPdf', permission: 'invoice.export' })
@Get(':id/pdf')
exportPdf() { /* ... */ }
```

### `@XemaPublicRoute(...)`

Declares the route is intentionally public — no authorization gate. You must say *why*:

```ts
@XemaPublicRoute({ reason: 'OpenAPI spec for client codegen', rateLimit: '60/min' })
@Get('openapi.json')
getOpenapi() { /* ... */ }
```

Public routes are surfaced in the org admin console so a security reviewer can verify the rationale.

### `@XemaInternalRoute(...)`

Declares the route is service-to-service only. The router refuses external traffic.

```ts
@XemaInternalRoute({ audience: ['xema-workflow-worker'] })
@Post('hooks/run-finished')
handleRunFinished() { /* ... */ }
```

Only the named audiences (registered service names) can reach the route. The runtime enforces this via the service-account token's `sub`.

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
@XemaCapabilities({ resource: 'invoice', version: 1, spaceFrom: ProjectSpace.fromParam('projectId') })
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
  ProjectSpace,
  OrgSpace,
  AppSpace,
  SessionSpace,
  InputSpace,
} from '@xemahq/xema-decorators';

ProjectSpace.fromParam('projectId')   // URL param
OrgSpace.fromHeader('x-xema-org')      // request header
AppSpace.fromParam('appId')
InputSpace.fromField('projectId')      // body field
```

Custom space resolvers are possible but discouraged — most controllers fit one of the built-ins. Anywhere the resolver returns `null` is treated as a fail-closed startup error: every Xema route must produce a SpaceRef.

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

## Permission and operationId inference

By default:

- **Permission name** = `<resource>.<action>` (e.g. `invoice.read`).
- **OperationId** = `<resource>.<action>` (same string).

When you need different permissions for routes that share an action, override the permission:

```ts
@XemaRoute({ permission: 'invoice.export' })
@Get(':id/pdf')
exportPdf() {}

@XemaRoute({ permission: 'invoice.export' })
@Get(':id/csv')
exportCsv() {}
```

Both routes register under one permission `invoice.export`; the operationIds stay distinct (`invoice.exportPdf` + `invoice.exportCsv`) because the inference engine uses method names there.

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
      discovery:    'decorators',      // or 'manual' for non-NestJS services
      policy:       'fail-closed',     // or 'fail-open' (dev only)
    }),
  ],
})
export class AppModule {}
```

At boot the module:

1. Scans every controller for the decorators above.
2. **Fail-closed startup**: any unclassified route is a startup error. The error message lists fix options.
3. Generates `.xema/generated/{routes,capabilities,service}.manifest.json` for inspection.
4. Registers the manifests through the [Service Registry](./service-registry.md) so the router can dispatch.

`fail-open` exists only for `xema dev` and is **forbidden in cluster mode** — the registry guard rejects services that boot with `policy: 'fail-open'` from a non-dev profile.

---

## Admin policy on top of generated permissions

Developers define **what exists**. Admins decide **who can do it**:

- Assign roles to permissions: `finance-member can invoice.read, invoice.list`.
- Override per-[environment](./environments.md): `acme-finance-prod: invoice.delete requires MFA + approval + audit`.
- Strengthen (always safe), Restrict (always safe), Weaken (org-owner only + audited + flagged).

The admin never edits the developer's annotations. The developer never edits the admin's policy.

---

## What this replaces

Before annotations:

- One `routes.manifest.json` per service, hand-maintained, frequently drifting from the controllers.
- One `permissions.manifest.json` listing every permission name, ditto.
- One `capabilities.manifest.json` listing every capability ref, ditto.
- An entire PR template section telling you to remember to update them.

After annotations:

- Manifests are **generated**. Boundary CI rejects hand-edits.
- A new endpoint is a one-line addition (`@XemaRoute() @Get(':id') read() {}`) and the right permission, operationId, and space-resolver appear automatically.
- The single source of truth lives next to the code it describes.

---

## Related concepts

- [Service registry](./service-registry.md) — what consumes the generated manifests.
- [Capabilities](./capabilities.md) — `@XemaCapability` produces these.
- [Spaces](./spaces.md) — `spaceFrom` resolves the SpaceRef for every request.
- [Policy](./policy.md) — admins attach policy to the generated permissions.

---

**Previous**: [← MCP and Capabilities](./mcp-and-capabilities.md)
**Next**: [CLI →](./cli.md)
