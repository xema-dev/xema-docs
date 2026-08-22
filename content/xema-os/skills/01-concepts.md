# Skill Concepts

A **skill** is a folder, not a file. `SKILL.md` is the only required file; the rest of the bundle — reference docs, style guides, scripts, assets, sub-skills — is free-form and mounted as-is into the agent workspace.

---

## The SKILL.md contract

`SKILL.md` is the only file `skill-registry-api` parses structurally. It must have a YAML frontmatter block with at least `name` and `description`:

```markdown
---
name: code-review
description: Teaches the agent to review diffs, apply style guides, and write structured review comments.
---

# Code Review Skill

Reference material, style guides, checklists, and examples...
```

Required frontmatter fields:

| Field | Type | Description |
|---|---|---|
| `name` | string | Unique slug within the skill's scope (kebab-case) |
| `description` | string | One sentence: what the skill enables the agent to do |

Everything else in `SKILL.md` (body, additional frontmatter keys) is free-form content consumed by the agent, not parsed by the platform.

---

## Ownership — five tiers of the one Space vocabulary

Every skill is owned at a Space, and that determines who can see it. More-specific wins when resolving conflicts.

There is no skill-specific ownership enum. The skill registry declares an **admissible subset** of the kernel's one `SpaceKind` — the five tiers below — and refuses anything outside it at every seam. That is deliberate: a private copy per registry is what made "publish my project skill to my organization" inexpressible, because there was no shared address a re-scope could name.

| Tier | Owner | Visibility |
|---|---|---|
| `System` | Platform-shipped (immutable) | All orgs, all users |
| `Biome` | Contributed by an installed biome's `skills/` folder | The org where the biome is installed |
| `Org` | Authored in Agent Studio for the org | All members of that org |
| `Project` | Scoped to a single project | Members of that project |
| `User` | Authored by a single user | That user only |

`User > Project > Org > Biome > System`, most specific first. When a project-owned `code-review` and an org-owned `code-review` both exist, the project-owned one is mounted.

That order is a **declared rank map**, not something derived from the Space tree — and it has to be. `user`, `org` and `biome` are root-addressable siblings under `system`, so the tree does not order a biome-owned row against an org-owned one *at all*. Deriving precedence from ancestry would leave both in an agent's resolved config, visible only as a doubled entry.

---

## SkillLayer — resolution layers

`SkillLayer` is a flat **provenance tag** naming which producer put a skill into a resolution response. It is separate from ownership, and it is deliberately *not* a precedence ladder — it carries no rank map and nothing sorts by it.

| Layer | Meaning |
|---|---|
| `System` | A platform-shipped system skill |
| `Base` | The agent definition's intrinsic skills |

Two members, because those are the two producers that exist. A `Pinned` and a `Context` member were declared once, assigned by nothing, and deleted.

---

## SkillSourceKind — where a skill comes from

| Source | Who creates it | How |
|---|---|---|
| `biome` | A biome's `skills/` folder | Seeded automatically when the biome is installed |
| `authored` | A user or org admin in Agent Studio | Manual authoring via the UI |
| `git_repo` | A registered git repository | The platform ingests `SKILL.md` (and sibling files) from the repo at a pinned git ref |

`git_repo` skills are versioned by git ref, not by the platform's version model. Update the pinned ref to pick up changes.

---

## System skill bundles

Xema ships a small set of built-in system skills in the `@xemahq/system-skills`
package. They are seeded into the registry at `System` space on boot, so they
are available to every agent in every org without anyone installing anything.

There are four top-level bundles:

| Bundle | What it teaches |
|---|---|
| `xema-os` | The root orientation skill for every Xema-resident agent — the runtime primitives, the cross-cutting concepts (Space, execution environment, execution context, policy), the XVFS namespace, and the rule that every capability call goes through the capability meta-tools |
| `coordinator-protocol` | The Plan → Delegate → Consolidate skeleton a coordinator agent follows to turn a problem statement plus a deliverable spec into one phase-level deliverable |
| `delegate-work` | The decision tree for handing a task to a sub-agent — which delegation strategy fits the task shape, and the shared-deliverable rule that prevents lost writes |
| `git-conflict-resolver` | Resolving merge conflicts during publish-to-production: which hunks are resolved mechanically, and which are escalated to a human |

`xema-os` is the one that demonstrates the recursive shape. It is not a flat
bundle — it carries eighteen sub-skills, each addressed by path
(`xema-os/capabilities`, `xema-os/spaces`, and so on):

```
agent-builder     biome-builder   biomes        capabilities
environments      memory          meta-tools    object-model
policy            runners         security-reviewer
service-registry  shell           spaces        store
store-publisher   versioning      workflow-author
```

That roster is a property of the shipped package and grows with the platform.
Ask the registry rather than this page if you need the current list.

System skills are immutable from the UI. To customise one, author a skill with
the same slug at `Org`, `Project` or `User` space — it wins by the ownership
ladder above, and the system bundle stays untouched underneath it.

---

**Previous**: ← (this is the first page in this section)

**Next**: [Authoring →](./02-authoring.md)
