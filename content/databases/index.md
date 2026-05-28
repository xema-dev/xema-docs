# Databases

> API Docs: https://org-database-pool-api.xema.dev/api/docs

Xema provides **org-managed databases** — fully-isolated, platform-managed relational databases provisioned and managed by the platform on behalf of each org. Biomes and apps get structured, schema-isolated access to persistent storage without managing infrastructure themselves.

Databases are provisioned through `org-database-pool-api`, which allocates databases in a fleet of devops-provided database clusters. Each org gets its own database; each biome and app gets its own schema within that database.

## Quick Links

| Page | What it covers |
|---|---|
| [Concepts](./01-concepts.md) | DB-per-org naming, schema-per-purpose, DbPool model, isolation guarantees |
| [Provisioning](./02-provisioning.md) | ProvisionDatabase workflow, naming conventions, capability gates |
| [Migrations](./03-migrations.md) | MigrationRunner interface, running migrations, Xema Workflow Runtime orchestration |
| [Connections](./04-connections.md) | Connection brokering, short-lived credentials, roles |
| [App Studio Dev/Prod](./05-webapp-studio.md) | Dev and prod schemas, Promote-to-prod workflow |

## Getting Started

1. **[Concepts](./01-concepts.md)** — understand the isolation model before provisioning.
2. **[Provisioning](./02-provisioning.md)** — provision your first org or biome database.
3. **[Connections](./04-connections.md)** — connect your biome or app to the database.
4. **[Migrations](./03-migrations.md)** — run schema migrations safely.

## FAQ

**Q: Do I manage the database server?**
A: No. The platform provisions databases in a devops-managed database cluster. You interact with your schema only, not the server or cluster configuration.

**Q: Can two biomes access the same schema?**
A: By default, each biome gets an isolated schema. Cross-biome schema access requires an explicit capability grant.

**Q: Is a specific migration framework required?**
A: The v1 runner uses a standard migration framework. The MigrationRunner interface is pluggable — future runners will support Drizzle, Flyway, and raw SQL. See [Migrations](./03-migrations.md).
