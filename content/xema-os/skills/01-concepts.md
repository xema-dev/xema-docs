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

## SkillScope — the 5-tier ownership model

Every skill has a scope that determines who owns it and who can see it. More-specific wins when resolving conflicts.

| Scope | Owner | Visibility |
|---|---|---|
| `System` | Platform-shipped (immutable) | All orgs, all users |
| `Plugin` | Contributed by an installed biome's `skills/` folder | The org where the biome is installed |
| `Org` | Authored in Agent Studio for the org | All members of that org |
| `Project` | Scoped to a single project | Members of that project |
| `User` | Authored by a single user | That user only |

`System > Plugin > Org > Project > User` in specificity. When a `Project`-scoped `code-review` and an `Org`-scoped `code-review` both exist, the project-scoped version is mounted.

---

## SkillLayer — resolution layers

`SkillLayer` describes which resolution layer selected a skill at mount time. It is separate from `SkillScope` (ownership):

| Layer | Meaning |
|---|---|
| `System` | A system skill was mounted (comes from `packages/kernel/system-skills/`) |
| `Base` | The agent definition's intrinsic skills |
| `Pinned` | Explicitly pinned by a composition node or workflow job |
| `Context` | Resolved from context at invocation time (active project, active biome) |

---

## SkillSourceKind — where a skill comes from

| Source | Who creates it | How |
|---|---|---|
| `plugin` | A biome's `skills/` folder | Seeded automatically when the biome is installed |
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
| `xema-os-concepts` | The six-layer model, zones, capabilities |
| `code-review-foundations` | Core code review patterns |
| `security-review-foundations` | OWASP, threat modelling, secure coding |
| `spec-writing-foundations` | Writing clear functional and technical specs |
| `documentation-foundations` | Writing accurate public-facing documentation |

System skills are immutable from the UI. To customize, create an `Org`-scoped skill with the same name — it wins by scope resolution.

---

**Previous**: ← (this is the first page in this section)

**Next**: [Authoring →](./02-authoring.md)
