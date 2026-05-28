# App Studio Dev/Prod

Apps in Xema have two database schemas: **dev** and **prod**. Dev is where active development and testing happen. Prod is the stable schema used by live, user-facing sessions. The **Promote-to-Prod** workflow moves validated changes from dev to prod in a controlled, audited way.

---

## Two schemas, one database

Both schemas live in the org's managed database:

| Schema | Purpose | Who uses it |
|---|---|---|
| `app_<slug>_dev` | Active development, testing, experiments | Developers and agents in test sessions |
| `app_<slug>_prod` | Stable production data | Live app sessions with real users |

The two schemas are structurally independent — each has its own migration history. This means dev can be ahead of prod by several migrations while prod stays stable.

---

## The development cycle

1. **Author changes** — a developer or agent modifies the app's schema migration file and writes a migration.
2. **Apply to dev** — run `xema db migrate dev --app webapp-studio` to apply the migration to `app_webapp-studio_dev`.
3. **Test** — run test sessions and automated checks against the dev schema.
4. **Promote** — when the dev schema is validated, promote to prod (see below).

---

## Promote-to-Prod

Promoting means applying the dev schema's pending migrations to the prod schema:

```bash
xema app promote --app webapp-studio
```

This triggers the `PromoteAppToProd` Xema Workflow Runtime job:

1. **Diff** — calculate pending migrations (migrations applied to dev but not prod).
2. **Pre-flight** — run connection checks, backup snapshot (if configured), and migration dry-run.
3. **Migrate** — apply pending migrations to `app_webapp-studio_prod` using the `MigrationRunner`.
4. **Verify** — run post-migration health checks declared in the app's `promotion-checks.json`.
5. **Complete** — mark the promotion record as `PROMOTED`; emit an audit event.

If any step fails, the workflow stops and surfaces a structured failure report. The prod schema is not left in a partially-migrated state because the pre-flight step validates the migration sequence before writing to prod.

---

## Rollback

Rolling back prod is explicit:

```bash
xema app rollback --app webapp-studio --to-version 1.2.3
```

This triggers a `RollbackAppSchema` workflow that:

1. Identifies the migration version to roll back to.
2. Runs `MigrationRunner.rollback()` with the target version.
3. Updates the migration history.
4. Emits an audit event.

Rollback is only available for migrations that declare a `down.sql` file. Migrations without a down migration cannot be automatically rolled back; the workflow surfaces this and requires manual intervention.

---

## Keeping dev and prod in sync

When prod is promoted, the platform automatically rebases dev's pending migrations on top of the new prod baseline. This prevents dev from accumulating migrations that are incompatible with prod's current state.

If rebase detects a conflict (e.g., a migration in dev modifies a column that was also modified in a prod migration), the platform surfaces the conflict and pauses the dev environment until the developer resolves it.

---

**Previous**: [← Connections](./04-connections.md)
