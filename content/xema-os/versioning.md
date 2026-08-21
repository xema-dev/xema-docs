# Versioning

Versioning in Xema OS is **user-controlled and lockfile-protected**. Every save creates an internal draft revision; only a deliberate publish freezes a draft into an immutable version. Installs pin exact versions in a lockfile. Capability refs are the one exception — they auto-version like syscalls.

This page covers the moving pieces: draft revisions, published versions, how a rollback works, the lockfile, and the breaking-change rule.

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

## One revision mechanism, four registries

Skills, agents, workflow definitions and artifacts each keep their own revision
history, in their own database — they are four separate services and no migration
merges them. What *is* shared is the **contract**: one kernel-owned revision shape
and one set of decision functions, which all four call rather than re-derive.

Concretely, every one of the four stores the same triad:

| Piece | What it is |
|---|---|
| An **identity** row | The stable thing a slug resolves to |
| **Revision** rows | Immutable content, an ascending sequence number, a content hash |
| Two **pointers** on the identity | `activeRevisionId` — the revision actually served; `draftId` — the one being edited |

Both pointers are unique columns, which is what makes the next section possible.
Artifacts declare no draft pointer at all, and that is a statement rather than an
omission: an artifact is *emitted* by a producer, never authored.

---

## Rollback is a pointer flip

Rolling back does **not** copy an old revision into the draft, and does not create a
new revision. It moves `activeRevisionId` back to a revision that is already there:

```
POST /skills/:id/governance/rollback
POST /authoring/agents/:identityId/rollback
POST /workflows/:slug/rollback
POST /artifacts/:id/rollback
```

Four properties, all of them load-bearing:

- **It creates nothing.** History is not rewritten and the sequence does not advance,
  so "what was served on Tuesday" stays answerable.
- **It does not touch the draft.** An author with unsaved work does not lose it
  because an admin rolled the served version back.
- **It refuses rather than clamps.** A target belonging to a different resource, an
  identity with no active revision, a target that is *already* active, or a revision
  that is no longer servable each produce a named refusal — never a best-effort
  guess at what was meant.
- **The swap is a compare-and-swap.** The write names the revision it expects to be
  replacing, so two concurrent rollbacks cannot interleave into a state neither
  operator asked for; the loser is told it lost. A durable trace is written inside
  the same transaction.

---

## Drafts are a bounded ring

Autosave would otherwise grow without limit, so draft history is a **ring of ten**
per resource. A draft entry is written only when the content hash actually changes,
so ten entries are ten distinct states an author produced, not ten keystrokes.

The draft currently pointed at by `draftId` is kept unconditionally, even if it
falls outside the window — evicting it would leave a pointer with nothing behind it,
and the symptom a user would see is not an error but a silent "no draft".

---

## Pins are partitioned, and one class never moves

Plenty of things point at a specific revision, and "move everything that points at
revision 3" is a natural-sounding bulk operation. It is also how history gets
corrupted, so the inventory sorts every reference into one of three classes and only
the first is movable:

| Class | Example | On a bulk move |
|---|---|---|
| **Mutable** | A launch preset pinned to a revision; a project-level agent override | Re-pointed |
| **Immutable** | A reference embedded *inside* an already-published revision | Listed, and the holder must republish |
| **Provenance** | A completed run's record of the revision it executed; an approval's pinned artifact version | **Never moved** |

The provenance class is the one worth naming explicitly, because it is shaped
exactly like a pin and is not one. Moving it would not re-point a consumer — it
would make a finished run claim it executed a revision it never saw. The planner
*partitions* rather than filters, so provenance is always visible in the answer, and
the listing reports its own truncation: concluding "nothing points at revision 3"
from a list that quietly stopped counting is precisely the failure the inventory
exists to prevent.

The pin inventory and the move operation ship today for workflow definitions and
agents; skills and artifacts have the rollback path but no pin move.

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

- **Apps.** `POST /apps/:id/lockfile/refresh` on `app-platform-api` resolves and persists a full pinned lockfile.
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
- [objects](./objects.md) — the scope / lifecycle / version triad every revisioned object carries

---

**Previous**: [← Store](./store.md)
**Next**: [Apps →](./apps.md)
