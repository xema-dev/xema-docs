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

The `@xemahq/database-sdk` (shipped in `platform-common`) wraps the connection broker and exposes a typed database client:

```ts
import { createDatabaseClient } from '@xemahq/database-sdk';

const db = await createDatabaseClient({ schemaName: 'biome_acme-review' });

// Query your schema's tables:
const reviews = await db.review.findMany({ where: { status: 'open' } });
```

The SDK handles credential refresh automatically. Long-running processes will transparently request new credentials before the TTL expires.

---

**Previous**: [← Migrations](./03-migrations.md)

**Next**: [App Studio Dev/Prod →](./05-webapp-studio.md)
