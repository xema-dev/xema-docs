# Versioning

Versioning in Xema OS is **user-controlled and lockfile-protected**. Every save creates an internal draft revision; only a deliberate publish freezes a draft into an immutable version. Installs pin exact versions in a lockfile. Capability refs are the one exception — they auto-version like syscalls.

This page covers the four moving pieces: draft revisions, published versions, the lockfile, and the breaking-change rule.

---

## Draft revisions vs published versions

Every editor in Xema — Agent Studio, Biome Studio, the workflow editor, the deliverable spec editor — saves into **draft revisions**. Drafts are mutable, never installable, never callable, never referenced by a lockfile.

```
agent:code-reviewer
  draft revisions: r41, r42, r43, r44      ← internal, never installed
  published versions: 1.0.0, 1.1.0, 2.0.0  ← what other objects depend on
```

Publishing snapshots the active draft into an immutable, semver-tagged version. From that moment the version is the only state the resolver returns for `slug` lookups. Drafts continue to evolve; the published version is frozen.

The lifecycle enum (`draft → published → archived`) is shared by every versioned [XemaObject](./objects.md) — agents, workflows, biomes, skills, templates, themes, deliverable specs. Archived versions stay resolvable as long as some lockfile names them.

See [draft-vs-published](./concepts/draft-vs-published.md) and [lifecycle](./concepts/lifecycle.md).

---

## Version constraints

Each installed reference (a biome in an app, a workflow in a pipeline, an agent in a composition) carries a constraint:

| Constraint | Meaning |
|---|---|
| `^1.2.0` | auto-upgrade compatible minor / patch (default for non-breaking) |
| `~1.2.0` | auto-upgrade patches only |
| `1.2.0` | frozen exact |
| `latest-compatible` | managed auto-upgrade within the major bound |

The default for production installs is caret range against the latest published version at install time. The user-facing UI exposes a "freeze" toggle per installed reference.

---

## Lockfile shape

At invocation boundaries (workflow run start, interactive session start, sub-agent spawn, app deploy) the resolver writes a lockfile pinning the exact versions of every XemaObject participating in the execution:

```json
{
  "kernel": "1.0.0",
  "capabilities": { "kb:page.read": "1", "workflow:run.start": "1" },
  "biomes":       { "xema.document-buddy": "1.4.2", "xema.software-dev": "1.5.0" },
  "agents":       { "code-reviewer": "3.0.0", "presenter-coach": "1.2.0" },
  "workflows":    { "product-development": "7.0.0" },
  "deliverableSpecs": { "architecture-doc": "2.1.0" },
  "skills":       { "doc-editor": "1.0.4" }
}
```

Lockfiles are produced by the resolver in `@xemahq/lockfile-resolver`. Concrete write paths:

- **Apps.** `POST /apps/:id/lockfile/refresh` on `app-runtime-api` resolves and persists a full pinned lockfile.
- **Sessions.** `agent-session-api`'s session-creation flow mints + persists a lockfile via the internal `SessionLockfileService` and serves `GET /sessions/:id/lockfile`.
- **Workflow runs.** The Xema workflow worker service emits a `xemaEmitRunLockfileActivity` as a Xema runtime activity that writes the lockfile as a `REPLACE`-versioned artifact (idempotent under retry).

Lockfile sources are shared across services through `@xemahq/lockfile-sources-nest`.

---

## Capability versions auto-bump

Capability refs version like syscalls, not like packages: `@1` and `@2` coexist indefinitely. A minor / patch change to an implementation never bumps the ref; a major bump is a deliberate, additive event that keeps `@1` alive until callers migrate.

This is the **only** place auto-versioning happens in Xema OS. Every other primitive respects the user-controlled draft-vs-published model.

When a capability ref changes major version:

- The biome that exposes the new version declares `exposesCapabilities: ["my-domain:thing@2"]`.
- Existing biomes that still expose `@1` keep working until they explicitly upgrade.
- Lockfiles record the resolved version per ref, so historical runs see the version that was current at run time.

---

## Capability auto-bump from the manifest

When a biome's manifest adds or removes a `requiresCapabilities[]` entry between published versions, the publishing pipeline computes the **capability diff** as part of the permission digest. The diff is what org admins approve on upgrade (Stage 1 install consent), and the diff is what the [Store](./store.md) shows to a publisher submitting a new version. The capability set is part of the published version's identity — it cannot drift.

The boundary check rejects any code path that resolves a capability whose major version is not declared in the calling biome's `requiresCapabilities[]` for the active lockfile version.

---

## Breaking changes

A breaking change requires a major-version bump on the published version. The user is prompted to choose:

- **Stay on the old major** (frozen) — the lockfile keeps the v1 entry; new installs of the biome still pick v1 unless explicitly upgraded.
- **Upgrade explicitly** — with a migration path the biome can ship as a workflow-step contribution.
- **Upgrade with fallback** — both majors stay installed; the capability resolver picks per lockfile.

There is no auto-migration. The user (or an org policy) holds the upgrade decision.

---

## Related concepts

- [draft-vs-published](./concepts/draft-vs-published.md) — the defining distinction
- [lifecycle](./concepts/lifecycle.md) — the `draft → published → archived` machine
- [lockfile](./concepts/lockfile.md) — what installs pin
- [capability](./concepts/capability.md) — the only auto-versioning surface
- [biomes](./biomes.md), [store](./store.md) — the publisher and distributor sides

---

**Previous**: [← Store](./store.md)
**Next**: [Apps →](./apps.md)
