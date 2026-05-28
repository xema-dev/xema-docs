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
/workspace/.xema/skills/
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

The agent reads these files using standard file-system navigation. The skill root is at `/workspace/.xema/skills/code-review/SKILL.md`.

---

## Slash commands

Every mounted skill automatically registers a slash command `/code-review` in the active agent session. Running `/code-review` invokes the skill's implied behavior — the agent reads `SKILL.md` and applies it to the current context.

The slash command is auto-generated from the skill's `name` frontmatter field. No additional configuration is needed.

Sub-skills do not get separate slash commands by default. Mount them explicitly if you want a dedicated slash command for a sub-skill.

---

## Scope and the authored skill API

To create an `Org`-scoped skill via the API:

```http
POST https://skill-registry-api.xema.dev/skills
Authorization: Bearer <org-admin-token>

{
  "name": "code-review",
  "description": "Org-standard code review skill",
  "scope": "Org",
  "source": "authored",
  "bundle": {
    "skillMd": "---\nname: code-review\n...",
    "resources": []
  }
}
```

For `git_repo` skills, provide `gitRepoRef` instead of `bundle`:

```json
{
  "name": "security-review",
  "description": "Security review skill from our eng standards repo",
  "scope": "Org",
  "source": "git_repo",
  "gitRepoRef": {
    "url": "https://github.com/acme/eng-skills",
    "path": "security-review/",
    "ref": "main"
  }
}
```

The platform ingests the skill at the pinned ref. Update the ref to pick up changes from the repo.

---

**Previous**: [← Concepts](./01-concepts.md)
