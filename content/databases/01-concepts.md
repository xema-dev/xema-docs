# Database Concepts

Xema provides one database per org, shared across all biomes and apps in that org. Within the org database, each biome and app gets its own isolated schema. This model keeps the cluster footprint predictable while giving each consumer independent migration control.

---

## One database per org

Every org gets exactly one database, named deterministically:

```
xema_org_<orgUlid>
```

Example: `xema_org_01j9kz3q7f4r2x5t8m0pnvdyw6`

The org ULID is used instead of the display name to ensure globally unique database names that are stable across org renames. The database is created once during org provisioning and destroyed only when the org is deleted.

---

## Schema-per-purpose

Within the org database, the platform maintains a strict naming convention for schemas:

| Schema pattern | Purpose | Owned by |
|---|---|---|
| `platform` | Platform-managed tables (biome registrations, capability grants) | `org-database-pool-api` |
| `biome_<slug>` | A biome's persistent storage | The biome |
| `app_<slug>_dev` | An app's development schema | The app |
| `app_<slug>_prod` | An app's production schema | The app |

Each schema is independently migrated. A broken migration in `biome_acme-review` does not affect `biome_code-tools` or any app schema.

---

## The DbPool model

`org-database-pool-api` maintains a **pool** of provisioned databases in a fleet of managed relational database clusters. Key properties:

- **Clusters are devops-provided** — the platform consumes a pre-registered cluster list. Adding a new cluster is a devops operation, not a developer operation.
- **Databases are allocated from the pool** — when an org is created, the provisioning workflow claims a slot in the pool and names the database. Pools refill asynchronously.
- **No cross-org database access** — the pool enforces that each database is exclusively owned by one org. Role isolation at the database level backs this up.

---

## Isolation guarantees

| Layer | How isolation is enforced |
|---|---|
| Database | One database per org; cross-org access requires a different database user with no cross-database grants |
| Schema | One schema per biome/app; database role grants are schema-scoped |
| Credentials | Short-lived credentials (see [Connections](./04-connections.md)); no static shared passwords |
| Migrations | Each schema has its own migration history; runner failures are isolated |

These guarantees hold under Xema's multi-tenant model. A compromised biome cannot read another biome's schema even if running in the same org database.

---

**Previous**: ← (this is the first page in this section)

**Next**: [Provisioning →](./02-provisioning.md)
