# Versioning Lockfile

Every workspace has a **lockfile** that pins the exact version of every dependency: biomes, agent definitions, skills, image variants, connector bindings, and deliverable specs. The lockfile is what makes workspace behavior reproducible across sessions, team members, and time.

---

## What the lockfile contains

```json
{
  "schemaVersion": "1",
  "generatedAt": "2026-05-27T10:00:00Z",
  "biomes": {
    "acme-code-review": { "version": "1.2.0", "digest": "sha256:abc123..." },
    "software-dev": { "version": "3.4.1", "digest": "sha256:def456..." }
  },
  "agents": {
    "reviewer@1.2.0": { "digest": "sha256:..." },
    "planner@2.0.1": { "digest": "sha256:..." }
  },
  "skills": {
    "code-review": { "version": "1.0.0", "source": "biome:acme-code-review" },
    "documentation-foundations": { "version": "system", "source": "system" }
  },
  "imageVariant": {
    "id": "acme-engineering",
    "tag": "acme/engineering:1.5.2",
    "digest": "sha256:..."
  },
  "deliverableSpecs": {
    "review-report": { "version": "2.1.0", "digest": "sha256:..." }
  }
}
```

The lockfile lives alongside the workspace manifest and is committed to source control when `autoCommit` is enabled.

---

## Generating and refreshing

The lockfile is generated automatically when a session is first allocated. It can be regenerated any time:

```bash
xema workspace lockfile refresh
```

This resolves all `@latest` or range-versioned references in the workspace manifest to their current pinned versions and rewrites the lockfile. Existing pinned versions are not changed unless you pass `--upgrade-all`.

---

## One-click update

To update specific biomes:

```bash
xema workspace lockfile update --biome acme-code-review
```

This:
1. Resolves the latest published version of `acme-code-review`.
2. Checks for breaking changes (capability additions, storage-schema migrations, removed contributions).
3. Shows a diff of what will change.
4. On confirmation, updates the lockfile entry and restarts the affected workspace services.

---

## Rollback

The lockfile is versioned in git (via auto-commit or manual commit). To roll back:

```bash
git checkout HEAD~1 -- workspace.lockfile.json
xema workspace lockfile apply
```

`apply` reads the lockfile and reconciles the running session to match it: downgrades biomes, restores pinned agent versions, and reverts any image variant changes.

---

## Reproducibility guarantee

Two sessions with the same lockfile, the same workspace manifest, and the same inputs produce the same outputs. This is the Xema reproducibility guarantee. It applies to:

- Agent behavior (same model, same skills, same tools).
- Workflow execution (same step versions, same deliverable spec contracts).
- Environment (same image variant digest).

The guarantee does not extend to LLM outputs (which are non-deterministic by nature) — it guarantees that the *execution environment* is identical, not the specific text generated.

---

**Previous**: [← Image Variants](./05-image-variants.md)

**Next**: [Examples →](./examples/)
