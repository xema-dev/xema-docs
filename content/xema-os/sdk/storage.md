# SDK — Storage

A biome that needs persistence has two choices:

- **Ship a full relational database schema** in a [biome-owned API](./backend-i-ship.md) — own the migrations, own the queries, own the operational surface.
- **Declare collections** in `xema-biome.json`'s `storage` block — let the shared **biome data plane** (`biome-storage-api`) host them, with per-tenant isolation, encryption, and a closed filter grammar already wired in.

This page documents the second path. The two patterns coexist — a biome may use both.

---

## Why the shared data plane

`biome-storage-api` is a multi-tenant managed database service that gives biomes:

- per-`(org, project, environment)` isolation — a biome installed twice (once `org`, once `sandbox`) sees two disjoint datastores;
- field-level encryption at rest;
- per-tenant quotas;
- a closed filter / index grammar — no raw SQL, no injection surface;
- an opaque collection layer — biomes never receive a DB handle, only typed row APIs.

Suitable for: feature flags, small lookup tables, per-install metadata, cached integration data, light bookkeeping.

Not suitable for: heavy joins, full-text search at scale, write-heavy event ingest, multi-collection transactions.

---

## Declaring collections

The `storage` block sits inside the `xema` block of `xema-biome.json`:

```jsonc
{
  "xema": {
    "ships": {
      "content": ["biomeStorageSchemas"]
    },
    "storage": {
      "namespace": "<biomeId>",
      "collections": [
        {
          "name": "incidents",
          "schemaPath": "storage/incidents.schema.json"
        }
      ],
      "isolation": "org",
      "uninstallPolicy": "retain"
    }
  }
}
```

| Field | Required | Purpose |
|---|---|---|
| `namespace` | yes | Stable per-biome namespace; usually the biome id |
| `collections[].name` | yes | Collection slug; unique within the namespace |
| `collections[].schemaPath` | yes | Path to the collection's JSON schema, relative to the biome root |
| `isolation` | yes | Closed enum: `org` \| `project` \| `sandbox` — the tenant grain rows are partitioned on |
| `uninstallPolicy` | yes | Closed enum: `retain` \| `drop-on-uninstall` — what `biome-host-api` does to the collection when the biome is removed |

Schemas declared in `xema-biome.json` are forwarded to `biome-storage-api` at install time. Breaking-schema upgrades (incompatible field type changes, dropped indexed columns) are rejected with a 409 — bump the biome's major version and ship a migration through `onUpgrade` (see [Lifecycle Hooks](./lifecycle-hooks.md)).

---

## Collection schema shape

The schema file is a JSON document describing fields, encrypted columns, and indexes:

```jsonc
{
  "fields": {
    "id":     { "type": "string", "primaryKey": true },
    "body":   { "type": "string", "encrypted": true },
    "status": { "type": "enum", "values": ["open", "closed"] },
    "openedAt": { "type": "timestamp" }
  },
  "indexes": [
    { "fields": ["status"] },
    { "fields": ["openedAt"] }
  ]
}
```

Closed-set rules:

- `fields[*].type` is a closed enum: `string` \| `number` \| `boolean` \| `enum` \| `timestamp` \| `json`.
- `enum` fields require a non-empty `values` array.
- `encrypted: true` fields are stored encrypted at rest via the platform-common encryption helpers; reads decrypt transparently for the calling biome.
- Indexes are explicit; the data plane refuses to query on un-indexed predicates.

---

## Isolation grain

| `isolation` | Partition key |
|---|---|
| `org` | `(orgId, namespace, collection)` |
| `project` | `(orgId, projectId, namespace, collection)` |
| `sandbox` | `(orgId, projectId, sandboxId, namespace, collection)` |

Authorization scopes the namespace to the partition key the calling subject is allowed to access. A biome installed in both `org` and `sandbox` zones sees two distinct datastores — a sandbox install can never read production rows.

Cross-environment reads are rejected at the gateway, not at the SQL layer. There is no opt-out.

---

## `uninstallPolicy`

| Value | Behaviour on `BiomeInstallation` deletion |
|---|---|
| `retain` | Rows survive uninstall; reinstalling the biome (same `namespace`) sees the prior data |
| `drop-on-uninstall` | The data plane drops the rows synchronously as part of the uninstall transition |

`retain` is the safe default for biomes that hold user data; `drop-on-uninstall` is appropriate for cache-style biomes whose rows are derivable from upstream sources.

---

## Reading and writing

Biome code never opens a DB handle. Every read and write is a capability call:

| Capability | Purpose |
|---|---|
| `biome-storage:collection.write@1` | Insert / update / delete rows in one of the biome's declared collections |
| `biome-storage:collection.read@1` | Read rows, with a closed predicate grammar (only indexed predicates allowed) |

The capabilities are declared in `requiresCapabilities[]` and gated by Stage-1 install consent. At runtime the gateway resolves the calling subject's `BiomeInstallGrant`, derives the partition key from the environment, and routes the call to `biome-storage-api`.

---

## Cross-biome data access

A biome **never** reads another biome's storage directly. To expose data across biomes:

1. The source biome declares a read capability (e.g. `biome:incidents.list@1`) in `exposesCapabilities[]`.
2. The source biome's API or lifecycle hook implements the capability, internally reading its own storage.
3. The consumer biome declares the same ref in `requiresCapabilities[]`.
4. The consumer biome invokes the ref through the capability gateway; the source biome decides what to return.

The Object Registry indexes exposed datasets so they appear in [XVFS](../concepts/xvfs.md) listings.

---

## Related pages

- [Manifest reference](./manifest.md) — the `storage` block
- [Backend I ship](./backend-i-ship.md) — when to ship a relational database schema instead
- [Lifecycle Hooks](./lifecycle-hooks.md) — `onUpgrade` for schema migrations, `onUninstall` for explicit cleanup
- [Capabilities](../capabilities.md) — the gateway every read / write routes through

---

**Previous**: [← Backend I ship](./backend-i-ship.md)
**Next**: [UI I contribute →](./ui-i-contribute.md)
