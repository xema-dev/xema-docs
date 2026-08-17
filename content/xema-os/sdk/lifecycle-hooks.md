# SDK — Lifecycle Hooks

> **Status: declared, not yet invoked.** The `lifecycle` block is a real, validated field of `xema-biome.json`, and a manifest that declares it is accepted today. **Nothing loads or runs the modules it names.** There is no host that resolves a hook path, no context object, and no transition at which a hook fires. Declaring the block has no runtime effect whatsoever.
>
> This page documents the **declaration** so the field's meaning is unambiguous and manifests written against it stay valid. Do not build a biome that depends on a hook running — it will not run, and it will not error either. Put install-time work in the biome's own service startup instead (see [Backend I ship](./backend-i-ship.md)).

Biomes may declare a **`lifecycle` block** naming module entry points intended to run at [biome lifecycle](../biomes.md#the-biome-lifecycle) transitions. The schema is `BiomeLifecycleHooksSchema`, exported from `@xemahq/kernel-contracts`.

---

## The `lifecycle` block

Five optional fields, each a module path relative to the biome package root:

```jsonc
"lifecycle": {
  "onInstall":   "dist/hooks/on-install.js",
  "onUninstall": "dist/hooks/on-uninstall.js",
  "onUpgrade":   "dist/hooks/on-upgrade.js",
  "onEnable":    "dist/hooks/on-enable.js",
  "onDisable":   "dist/hooks/on-disable.js"
}
```

| Field | Intended transition |
|---|---|
| `onInstall` | A new installation is created |
| `onUninstall` | An installation is archived or explicitly uninstalled |
| `onUpgrade` | A published version is swapped for another |
| `onEnable` | An admin re-enables a previously disabled installation |
| `onDisable` | An admin disables an installation without uninstalling |

Every field is optional, and the table above describes **intent, not behaviour** — no transition currently invokes anything.

---

## What actually happens today

Exactly one thing: **validation of the strings**.

- The manifest parser checks that each declared value is a non-empty string. That is the whole of it.
- The module path is never resolved. The file it names need not exist — a `lifecycle` block pointing at a path that was never built parses clean.
- No transition loads a module, so a hook cannot fail, cannot be retried, and produces no audit entry.

Because the block is validated but inert, a biome that declares it is not broken; it simply gets nothing. The field is kept in the schema — rather than deleted — because it is part of the published manifest surface that third-party bundles are parsed against, and removing it would reject manifests already written to it.

---

## If you need install-time work now

Until hooks are invoked, use a mechanism that actually runs:

- **Seeding, migrations, and one-shot setup** — do it in your biome service's own startup path. The service runs; a hook does not. See [Backend I ship](./backend-i-ship.md).
- **Reacting to platform state changes** — subscribe to events. See [Events I subscribe](./events-i-subscribe.md).
- **Schema changes across versions** — run the migration from the service on boot, guarded by a stored schema version. See [Storage](./storage.md).

---

## Related pages

- [Biomes — lifecycle](../biomes.md#the-biome-lifecycle) — the state machine this block is intended to attach to
- [Manifest](./manifest.md) — every field of `xema-biome.json`
- [Backend I ship](./backend-i-ship.md) — where install-time work belongs today
- [Storage](./storage.md) — declared collections and `uninstallPolicy`

---

**Previous**: [← Manifest](./manifest.md)
**Next**: [Backend I ship →](./backend-i-ship.md)
