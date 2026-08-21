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
2. **Apply to dev** — run the Shell's `db migrate` command against the dev database to apply the migration to `app_webapp-studio_dev`.
3. **Test** — run test sessions and automated checks against the dev schema.
4. **Promote** — when the dev schema is validated, promote to prod (see below).

---

## Promote-to-Prod

Promoting means applying the dev schema's pending migrations to the prod schema. Promotion is a single call — `POST /app-dbs/:id/promote-to-prod` on `webapp-studio`, driven from the Studio UI:

1. **Diff** — calculate pending migrations (migrations applied to dev but not prod).
2. **Pre-flight** — run connection checks, backup snapshot (if configured), and migration dry-run.
3. **Migrate** — apply pending migrations to `app_webapp-studio_prod` using the app's declared migration runner.
4. **Verify** — run post-migration health checks declared in the app's `promotion-checks.json`.
5. **Complete** — mark the promotion record as `PROMOTED`; emit an audit event.

If any step fails, the workflow stops and surfaces a structured failure report. The prod schema is not left in a partially-migrated state because the pre-flight step validates the migration sequence before writing to prod.

---

## Rollback

Rolling back prod is explicit:

> **Schema rollback is not implemented.** There is no rollback workflow, service
> method, or route for an app's prod schema — a promotion that must be undone is
> undone by authoring a forward migration that reverses it, and applying that
> through the normal promote path.
>
> This is documented as absent rather than omitted, because "roll it back" is the
> first thing anyone reaches for after a bad promotion, and finding out then is
> the worst time to find out. Plan promotions on the assumption that they are
> forward-only, and use the pre-flight step below.

The protection that *does* exist is on the way in, not the way out: promotion
pre-flights the migration sequence before writing to prod, so a sequence that
cannot apply cleanly is refused rather than half-applied.

---

## Keeping dev and prod in sync

When prod is promoted, the platform automatically rebases dev's pending migrations on top of the new prod baseline. This prevents dev from accumulating migrations that are incompatible with prod's current state.

If rebase detects a conflict (e.g., a migration in dev modifies a column that was also modified in a prod migration), the platform surfaces the conflict and pauses the dev environment until the developer resolves it.

---

**Previous**: [← Connections](./04-connections.md)
