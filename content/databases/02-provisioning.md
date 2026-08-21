# Provisioning

Org databases are provisioned automatically during org creation. Biome and app schemas are provisioned when the biome or app is installed or deployed. This page explains the provisioning lifecycle and capability gates.

---

## Org database provisioning

When a new org is created, the platform runs the `ProvisionDatabaseWorkflow` workflow:

1. Select an available database cluster from the pool.
2. Create the database: `CREATE DATABASE xema_org_<orgUlid>`.
3. Create the `platform` schema and seed platform-managed tables.
4. Register the database in `org-database-pool-api` with the org ID.
5. Issue the org's service credentials (see [Connections](./04-connections.md)).

This happens automatically. No manual action is needed from the org admin.

---

## Biome schema provisioning

When a biome is installed into an org, the platform provisions its schema:

1. Connect to the org's database.
2. Create the schema: `CREATE SCHEMA biome_<slug>`.
3. Grant the biome's database role full access to `biome_<slug>`.
4. Run the biome's initial migrations (see [Migrations](./03-migrations.md)).

Schema provisioning is triggered by the `BiomeInstallGrant` approval event. It is idempotent — re-running provisioning for an already-installed biome is safe.

---

## App schema provisioning

When an app is created in an org:

1. Create the dev schema: `CREATE SCHEMA app_<slug>_dev`.
2. Create the prod schema: `CREATE SCHEMA app_<slug>_prod`.
3. Grant the app's database role access to both schemas.
4. Run initial migrations for both schemas.

Apps always get both a dev and a prod schema. See [App Studio Dev/Prod](./05-webapp-studio.md) for how these are used.

---

## Capability gates

Database provisioning is capability-gated. The following capabilities are required:

| Capability | Required for |
|---|---|
| `org-db:database.create@1` | Provisioning the org database (platform-internal only) |
| `org-db:database.use@1` | Reading and writing to a biome or app schema |
| `org-db:database.migrate@1` | Running schema migrations |

`org-db:database.create@1` is held exclusively by platform internals. Biomes and apps cannot provision new databases — they receive schemas within the org's existing database.

Biomes declare `org-db:database.use@1` and `org-db:database.migrate@1` in their capability manifest. These are granted at install time when the org admin approves the `BiomeInstallGrant`.

---

## Naming conventions

| Object | Naming convention |
|---|---|
| Database | `xema_org_<orgUlid>` |
| Biome schema | `biome_<biomeSlug>` |
| App dev schema | `app_<appSlug>_dev` |
| App prod schema | `app_<appSlug>_prod` |
| Biome DB role | `role_biome_<biomeSlug>` |
| App DB role | `role_app_<appSlug>` |

Slugs use only lowercase letters, digits, and underscores. Hyphens in biome/app slugs are replaced with underscores in database object names.

---

**Previous**: [← Concepts](./01-concepts.md)

**Next**: [Migrations →](./03-migrations.md)
