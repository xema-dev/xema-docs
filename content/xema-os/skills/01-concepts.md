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

Xema ships 14 built-in system skills under `packages/kernel/system-skills/`. These are always available to every agent in every org:

| Bundle | What it teaches |
|---|---|
| `xema-shell-basics` | Using the Xema Shell and its built-in commands |
| `workflow-dsl` | Writing and reading workflow YAML |
| `deliverable-specs` | Authoring and reviewing deliverable specs |
| `knowledge-base-navigation` | Querying and navigating the knowledge base |
| `artifact-store` | Reading and writing artifacts |
| `connector-usage` | Using SCM, tracker, docs, and chat connectors |
| `biome-authoring` | Writing and validating biome manifests |
| `skill-authoring` | Writing skill bundles and sub-skills |
| `agent-composition` | Composing multi-agent workflows |
| `xema-os-concepts` | The six-layer model, execution environments, capabilities |
| `code-review-foundations` | Core code review patterns |
| `security-review-foundations` | OWASP, threat modelling, secure coding |
| `spec-writing-foundations` | Writing clear functional and technical specs |
| `documentation-foundations` | Writing accurate public-facing documentation |

System skills are immutable from the UI. To customize, create an `Org`-scoped skill with the same name — it wins by scope resolution.

---

**Previous**: ← (this is the first page in this section)

**Next**: [Authoring →](./02-authoring.md)
