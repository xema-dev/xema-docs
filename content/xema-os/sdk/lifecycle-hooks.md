# SDK — Lifecycle Hooks

Biomes may declare optional **lifecycle hooks** — module entry points that `biome-host-api` invokes at the corresponding [biome lifecycle](../biomes.md#the-biome-lifecycle) transitions. Hooks run with the biome's own capability set; they can do nothing the biome itself cannot do at runtime.

The hook contract is declared in the `lifecycle` block of `xema-biome.json`. The kernel schema is `BiomeLifecycleHooksSchema` in `@xemahq/biome-contracts`.

---

## The `lifecycle` block

Five optional hook fields, each one a module path relative to the biome package root:

```jsonc
"lifecycle": {
  "onInstall":   "dist/hooks/on-install.js",
  "onUninstall": "dist/hooks/on-uninstall.js",
  "onUpgrade":   "dist/hooks/on-upgrade.js",
  "onEnable":    "dist/hooks/on-enable.js",
  "onDisable":   "dist/hooks/on-disable.js"
}
```

| Field | Fires on | Typical use |
|---|---|---|
| `onInstall` | `draft → sandbox-installed` or `store-approved → org-installed` for a new install | Seed default rows in the biome's storage, register MCP tools, create connector binding shells |
| `onUninstall` | `org-installed → archived` or explicit uninstall | Drop the biome's collections (subject to `storage.uninstallPolicy`); clean external connector shells |
| `onUpgrade` | Major / minor / patch swap of a published version | Run data-migration code; rewrite stored documents to the new schema |
| `onEnable` | An admin re-enables a previously disabled installation | Resubscribe to events, rehydrate caches |
| `onDisable` | An admin disables an installation without uninstalling | Pause subscriptions, mark caches stale |

Every field is optional. The kernel does not load the module at manifest-parse time — it only validates that the manifest declares well-formed strings. The host loads the module at the transition.

---

## Where hooks run

- Each hook runs in the same execution environment the biome itself runs in for that installation (typically `org` or `sandbox`).
- The hook process inherits the biome's `BiomeInstallGrant` — every capability call it makes goes through `xema-capability-router` exactly like any other biome call.
- Hooks never receive raw credentials. To call an external service (push a webhook, post to Slack), they invoke the matching `connector:*` [capability](../capabilities.md).

The hook is **not** a free-form privilege escalation — if the biome itself cannot do something at runtime, the hook cannot either. This is by design.

---

## Hook module shape

A hook module is a CommonJS or ESM module that default-exports an async function:

```ts
// dist/hooks/on-install.js
import type { BiomeLifecycleHookContext } from '@xemahq/biome-host-sdk';

export default async function onInstall(ctx: BiomeLifecycleHookContext): Promise<void> {
  // ctx.installationId  — string
  // ctx.orgId           — string
  // ctx.projectId       — string | null (null when scope=org)
  // ctx.previousVersion — semver | null (null on fresh install)
  // ctx.currentVersion  — semver
  // ctx.environment            — ExecutionZoneRef
  // ctx.callCapability  — (ref, input) => Promise<unknown>
  await ctx.callCapability('biome-storage:collection.write@1', {
    collection: 'incidents',
    row: { id: 'seed-1', body: 'welcome', status: 'open' },
  });
}
```

The context object is the only thing the kernel passes to the hook. There are no globals, no `process.env` access beyond what the canonical service Dockerfile permits, and no direct DB handles. The hook talks to Xema through `ctx.callCapability` and nothing else.

---

## Idempotency and retries

Lifecycle transitions are mediated by capability calls (`biome:install@1`, `biome:promote@1`, …) and audited; the host retries failed transitions with exponential backoff. Hooks **must** be idempotent — the host may invoke them more than once for one logical transition. Reasonable patterns:

- Upsert-or-noop on every `onInstall` write.
- Read the current schema version before running `onUpgrade` migrations; skip when already at the target version.
- Delete with `WHERE … AND not-yet-deleted` predicates on `onUninstall`.

The host wraps hook invocation in a structured audit-log entry — failures are visible via `xema why-denied <auditId>` (see [Shell](../shell.md)).

---

## Capability requirements

Hooks count against the biome's `requiresCapabilities[]` like any other code path. If `onInstall` calls `connector:tracker.issue.create@1`, that ref must appear in the manifest's `requiresCapabilities[]` and in the Stage-1 [permission digest](../biomes.md#install--stage-1-consent). Otherwise the gateway denies the call at runtime.

The boundary check ensures hook modules import only from `@xemahq/*` published packages and the biome's own files — cross-biome imports are rejected.

---

## Related pages

- [Biomes — lifecycle](../biomes.md#the-biome-lifecycle) — the state machine the hooks attach to
- [Manifest reference](./manifest.md) — the `lifecycle` block field-by-field
- [Backend I ship](./backend-i-ship.md) — when to ship a full backend service vs lifecycle hooks
- [Storage](./storage.md) — how `onInstall` / `onUninstall` interact with the data plane

---

**Previous**: [← Manifest](./manifest.md)
**Next**: [Backend I ship →](./backend-i-ship.md)
