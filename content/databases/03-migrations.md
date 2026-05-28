# Migrations

Schema migrations in Xema are workflow-orchestrated, isolated per schema, and pluggable. The platform runs migrations through the `MigrationRunner` interface; the Xema migration framework is the v1 implementation.

---

## The MigrationRunner interface

Every migration runner implements:

```ts
interface MigrationRunner {
  run(context: MigrationContext): Promise<MigrationResult>;
  status(context: MigrationContext): Promise<MigrationStatus>;
  rollback(context: MigrationContext, targetVersion: string): Promise<MigrationResult>;
}

interface MigrationContext {
  connectionUrl: string;     // short-lived credential URL (see Connections)
  schemaName: string;        // e.g. "biome_acme-review"
  migrationsPath: string;    // path to migration files inside the biome bundle
  targetVersion?: string;    // if absent, run all pending migrations
}
```

This interface is what the platform calls. The platform does not care which migration tooling the runner uses (Drizzle, Flyway, raw SQL, or others) — it only cares about the contract.

---

## Default migration runner (v1)

The default runner. It:

1. Connects to the schema using the provided `connectionUrl`.
2. Runs all pending migrations in `migrationsPath` against the target schema.
3. Records the migration history in the migration history table inside the target schema.
4. Returns a `MigrationResult` with applied/skipped/failed counts.

Migration files in the biome bundle are organized by timestamp and name:

```
biome/
  migrations/
    20260527_001_create_reviews/
      migration.sql
    20260527_002_add_comments/
      migration.sql
  schema.migration
```

---

## When migrations run

Migrations run as part of three platform workflows:

| Workflow | When triggered | What it does |
|---|---|---|
| `ProvisionBiomeSchema` | At biome install | Runs all migrations from scratch on the new schema |
| `RunBiomeMigrations` | On biome version update | Runs migrations added since the previous version |
| `PromoteAppToProd` | On app production deploy | Runs migrations on the prod schema (see [App Studio Dev/Prod](./05-webapp-studio.md)) |

All three workflows use the `MigrationRunner` interface. They are orchestrated by the Xema Workflow Runtime, which provides retry, timeout, and observability.

---

## Migration failure behavior

If a migration fails:

1. The workflow marks the migration step as `FAILED`.
2. The schema is left in the partially-migrated state (the database does not auto-rollback DDL across statements).
3. The biome remains in `schema-migration-failed` state — it can read existing data but cannot write to newly-expected columns.
4. The org admin receives an alert with the failed migration SQL and the database error.

To recover: fix the migration SQL, publish a new biome version, and re-trigger `RunBiomeMigrations`.

---

## Manual migration control

For migrations that require careful sequencing (large table rewrites, zero-downtime schema changes), the migration can be marked `manual-only` in the biome's migration manifest:

```json
{
  "migration": "20260527_003_reindex_reviews",
  "mode": "manual-only",
  "instructions": "Run CONCURRENTLY to avoid table lock. See ops runbook."
}
```

Manual-only migrations are skipped by the automatic runner and surfaced in the org admin dashboard with the instructions. An org admin must run them explicitly via `xema db migrate run --migration 20260527_003_reindex_reviews`.

---

**Previous**: [← Provisioning](./02-provisioning.md)

**Next**: [Connections →](./04-connections.md)
