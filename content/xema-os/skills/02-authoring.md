# Authoring Skills

This page explains how to write a skill bundle, add sub-skills, and use the slash-command surface that the platform auto-generates.

---

## Minimal skill bundle

The smallest valid skill is a single folder containing `SKILL.md`:

```
code-review/
  SKILL.md
```

```markdown
---
name: code-review
description: Teaches the agent to review diffs, apply style guides, and write structured review comments.
---

# Code Review Skill

Review every change for:
1. Correctness — does the logic match the spec?
2. Style — does the code follow the team's style guide?
3. Security — does the change introduce any OWASP Top 10 risks?

Write comments in the format: `[LEVEL] File:line — Reason`.
```

This is enough for the platform to mount the skill and register a `/code-review` slash command.

---

## Adding reference material

Add any files to the bundle folder. The agent can read them by navigating the mounted workspace:

```
code-review/
  SKILL.md
  reference/
    style-guide.md
    security-checklist.md
    owasp-top-10.md
  examples/
    good-review.md
    bad-review.md
```

Reference files are mounted as-is. Use plain Markdown so the agent can read and cite them. Avoid binary files — they increase bundle size without providing readable content.

---

## Sub-skills

Sub-skills are nested folders, each with their own `SKILL.md`. They are mounted as children of the parent:

```
code-review/
  SKILL.md
  reference/
    style-guide.md
  security-review/                 ← sub-skill
    SKILL.md
    reference/
      threat-model-template.md
  performance-review/              ← sub-skill
    SKILL.md
```

Sub-skills are addressed by path: `code-review/security-review`. They appear as nested entries in the skill registry and are individually mountable.

---

## Workspace mount layout

When an agent runs with the `code-review` skill mounted, its workspace receives:

```
<skills mount>/
  code-review/
    SKILL.md
    reference/
      style-guide.md
      security-checklist.md
    security-review/
      SKILL.md
      reference/
        threat-model-template.md
```

The bundle is mounted verbatim — same file names, same nesting, sub-skills as
child directories — under a platform-managed skills directory inside the
workspace. The agent reads it with ordinary file-system navigation, starting
from the bundle's own `SKILL.md`. Author against the bundle layout, never
against an absolute path: the mount location is the runtime's to choose and is
not part of the contract.

### Mounting is not live

The skill set is written to the workspace **before** the agent runtime starts,
and the runtime scans it **once**. There is no filesystem watch and no refresh
interval. Publishing or changing a skill therefore affects the **next** session,
not one that is already running — an open agent keeps the skills it launched
with until it is restarted. Design around that rather than expecting a live
pickup.

---

## Slash commands

Every mounted skill automatically registers a slash command `/code-review` in the active agent session. Running `/code-review` invokes the skill's implied behavior — the agent reads `SKILL.md` and applies it to the current context.

The slash command is auto-generated from the skill's `name` frontmatter field. No additional configuration is needed.

Sub-skills do not get separate slash commands by default. Mount them explicitly if you want a dedicated slash command for a sub-skill.

---

## Authoring a skill through the API

Two routes create a skill, and they take different shapes.

**A single-file skill** — `POST /skills`. The SKILL.md arrives as one string:

```http
POST https://skill-registry-api.xema.dev/skills
Authorization: Bearer <token>
Content-Type: application/json

{
  "slug": "code-review",
  "name": "Code Review",
  "description": "Org-standard code review skill",
  "scope": "org",
  "skillMarkdown": "---\nname: code-review\ndescription: Reviews diffs against the org style guide.\n---\n\n# Code Review Skill\n\n..."
}
```

`slug` is hierarchical — `software-engineering/requirements` nests the skill
under its parent. `scope` is the kernel `SpaceKind` value, **lower-case**, and
this route accepts `org`, `project` or `user`; the platform-owned tiers are not
authorable. Optional: `kind`, `injectionMode`, `category`, `tags`, `parentSlug`.

Two fields you might expect and will not find. There is no source field — the
route sets the source itself, because a skill authored through it is authored
by definition. And there is no owner id anywhere in the body: authority comes
from the request context, so the body names the *tier* and never the *id*.

**A multi-file bundle** — `POST /skills/bundle`. This is the route to use when
the skill has reference material:

```http
POST https://skill-registry-api.xema.dev/skills/bundle
Authorization: Bearer <token>
Content-Type: application/json

{
  "slug": "code-review",
  "scope": "org",
  "skillMarkdown": "---\nname: code-review\ndescription: Reviews diffs against the org style guide.\n---\n\n# Code Review Skill\n\n...",
  "resources": [
    {
      "relPath": "reference/style-guide.md",
      "type": "reference",
      "contentBase64": "IyBTdHlsZSBndWlkZQo="
    }
  ]
}
```

`name` and `description` are **not** request fields here — they are read from
the SKILL.md frontmatter, so the bundle has exactly one place that states them.
`relPath` is relative to the bundle root and may not begin with `/` or escape
upward. A resource whose `relPath` is itself a `SKILL.md` is ingested as its own
sub-skill row rather than as a file of the parent, which is how the recursive
structure on disk survives the round trip.

---

## Ingesting skills from a git repository

A git-sourced skill is not a variant of the create call — it is a registered
*repository* that the platform scans:

```http
POST https://skill-registry-api.xema.dev/skill-repositories
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://github.com/acme/eng-skills",
  "ref": "main",
  "rootPath": "skills/"
}
```

Then ingest it:

```http
POST https://skill-registry-api.xema.dev/skill-repositories/<id>/sync
```

The sync walks the repository for every `SKILL.md`, ingests each one as an
org-scoped skill, and prunes skills whose files have been removed. `ref` pins
the version — move the ref and re-sync to pick changes up. `rootPath` narrows
the scan to a sub-directory.

---

**Previous**: [← Concepts](./01-concepts.md)
