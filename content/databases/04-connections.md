# Connections

Biomes and apps connect to their database schemas using **short-lived credentials** brokered by `org-database-pool-api`. There are no static shared passwords. Every connection request returns a credential that expires after a configurable TTL.

---

## Connection brokering

When a biome needs to connect to its schema, it requests a connection URL from the connection broker:

```http
POST https://org-database-pool-api.xema.dev/connections/request
Authorization: Bearer <service-token>

{
  "schemaName": "biome_acme-review",
  "ttlSeconds": 300
}
```

Response:

```json
{
  "connectionUrl": "postgresql://role_biome_acme-review:tok_xp9ab...@pg-cluster-01.xema.dev:5432/xema_org_01j9kz...",
  "expiresAt": "2026-05-27T10:05:00Z"
}
```

The biome uses the returned `connectionUrl` for the duration of the connection. When the credential expires, the biome requests a new one. Credential rotation happens transparently from the biome's perspective.

---

## Roles and permissions

Each schema consumer gets a dedicated database role:

| Consumer | Role name | Permissions |
|---|---|---|
| Biome | `role_biome_<slug>` | `USAGE` + `SELECT, INSERT, UPDATE, DELETE` on `biome_<slug>.*` |
| App (dev) | `role_app_<slug>` | `USAGE` + full DML on `app_<slug>_dev.*` |
| App (prod) | `role_app_<slug>` | `USAGE` + full DML on `app_<slug>_prod.*` |
| Platform | `role_platform` | `USAGE` + DDL on all schemas (for provisioning and migrations) |

Roles are database-level roles, not application-level roles. They are created at schema provisioning time and cannot be expanded by the biome or app.

---

## Connection pooling

All connections go through a connection pool maintained by the platform. Biomes and apps do not connect directly to the database server. This provides:

- Connection count limits (prevents a single biome from exhausting the cluster).
- Automatic reconnection on transient failures.
- Query-level observability for the platform team.

The `connectionUrl` returned by the broker points to the connection pool, not directly to the database server.

---

## SDK usage

`@xemahq/biome-database-nest` is the whole integration. A biome carries **no** database configuration — no host, no credential, no URL, no schema name, nothing to put in a Helm chart or a secret. The module resolves the connection from `org-database-pool-api` at boot, builds a schema-qualified Prisma client for it, and applies the service's own Prisma migrations before the app serves traffic:

```ts
import {
  BiomeDatabaseMigrationMode,
  BiomeDatabaseModule,
} from '@xemahq/biome-database-nest';

BiomeDatabaseModule.forRoot({
  biomeId: 'acme-review',
  migrationMode: BiomeDatabaseMigrationMode.ApplicationManaged,
  databases: [{ workspaceDir: process.cwd() }],
});
```

`biomeId` names the database this service owns. It is **pinned by the pool on first resolve**, so changing it later is refused rather than silently pointing the service at a fresh empty schema. `workspaceDir` is where the Prisma schema and its `migrations/` directory live.

A service that needs a second database declares it:

```ts
databases: [
  { workspaceDir: process.cwd() },
  { key: 'analytics', workspaceDir: `${process.cwd()}/analytics` },
],
```

Migrations run with `prisma migrate deploy`, which **throws** on failure — a bad migration stops the pod becoming ready instead of half-applying under live traffic. Credential refresh is handled for you: long-running processes transparently obtain new credentials before the TTL expires.

---

**Previous**: [← Migrations](./03-migrations.md)

**Next**: [App Studio Dev/Prod →](./05-webapp-studio.md)
