# Authoring a Biome

A biome is a folder. You need a `xema-biome.json` manifest and at least one contribution. This page walks through the authoring lifecycle from first file to local validation.

---

## Folder layout

```
acme-code-review/
  xema-biome.json               ← manifest (required)
  contracts/
    capabilities.json           ← exposesCapabilities + requiresCapabilities
    permissions.json            ← role-capability + environment hooks
    events.json                 ← declarative subscribes[]
  agents/
    reviewer.agent.json         ← agent definitions
  skills/
    code-review/                ← skill folder bundle (SKILL.md required)
      SKILL.md
      reference/
        style-guide.md
  workflows/
    pr-review.yaml              ← workflow YAML
  specs/
    review-report.yaml          ← deliverable spec
  backend/
    api/                        ← optional backend service
    migrations/                 ← storage schema migrations
    handlers/                   ← event subscription handlers
  frontend/
    routes/                     ← UI route contributions
    slots/                      ← host extension slot contributions
```

---

## `xema-biome.json` — full reference

```json
{
  "name": "acme-code-review",
  "version": "1.2.0",
  "displayName": "Acme Code Review",
  "description": "PR review workflows and AI reviewer agents for engineering teams.",
  "author": "Acme Engineering",
  "homepage": "https://acme.example.com/docs/biomes/code-review",
  "lifecycle": "draft",

  "requiresCapabilities": [
    "connector:scm.create-pull-request@1",
    "connector:scm.merge@1",
    "kb:page.write@1",
    "artifact:blob.read@1"
  ],

  "exposesCapabilities": [],

  "permissionHints": {
    "connector:scm.create-pull-request@1": "Posts inline review comments and a summary to the PR.",
    "connector:scm.merge@1": "Merges the PR when all checks pass and the review is approved.",
    "kb:page.write@1": "Stores the review report in the knowledge base.",
    "artifact:blob.read@1": "Reads the PR diff artifact produced by the trigger workflow."
  },

  "defaultProfile": "internal-agent",

  "contributions": {
    "agents": ["agents/reviewer.agent.json"],
    "skills": ["skills/code-review/"],
    "workflows": ["workflows/pr-review.yaml"],
    "specs": ["specs/review-report.yaml"]
  },

  "executionZones": ["org", "project"],

  "uninstallPolicy": "delete"
}
```

### Key fields explained

**`requiresCapabilities`** — every capability ref the biome may invoke at runtime. Declaring a capability here does not grant it; the org admin approves the grant at install time. If a capability is not declared here, the gateway denies every call for it, regardless of any grant.

**`exposesCapabilities`** — capability refs this biome makes available to other biomes or agents. Optional; most biomes leave this empty.

**`defaultProfile`** — the built-in permission profile that best fits this biome's risk level. Shown to the org admin as the recommended starting point. Options: `read-only-assistant`, `support-chatbot`, `internal-agent`, `connector-bridge`, `unrestricted`.

**`executionZones`** — the zones this biome may run in. The capability gateway enforces that every call is made within one of these zones. Omit to default to `["org"]`.

**`uninstallPolicy`** — what happens to org data when the biome is archived. `delete` purges the managed storage schema; `retain` keeps it (useful for compliance). Defaults to `retain`.

---

## Writing skill contributions

Skills contributed by a biome live under `skills/` as folder bundles. Each bundle must have a `SKILL.md` file with `name` and `description` frontmatter:

```markdown
---
name: code-review
description: Teaches the agent to review diffs, apply style guides, and write structured review comments.
---

# Code Review Skill

...reference material, style guides, checklists...
```

Sub-skills are nested folders:

```
skills/
  code-review/
    SKILL.md                         ← required
    reference/
      style-guide.md
    sub-skills/
      security-review/
        SKILL.md                     ← each sub-skill also requires SKILL.md
```

The platform mounts the full bundle at `/workspace/.xema/skills/code-review/` in the agent workspace and registers a `/code-review` slash command automatically.


---

## Writing agent contributions

An agent definition is a JSON file in `agents/`:

```json
{
  "slug": "reviewer",
  "version": "1.0.0",
  "displayName": "PR Reviewer",
  "description": "Reviews pull requests using the code-review skill and writes structured feedback.",
  "systemPrompt": "You are an expert code reviewer...",
  "intrinsicSkills": ["code-review"],
  "intrinsicTools": ["mcp-tool:github.read-pr@1"],
  "defaultModel": "gpt-4o"
}
```

---

## Local validation

Before pushing, validate the manifest and contributions:

```bash
xema biome validate ./acme-code-review
```

The validator checks:

- `xema-biome.json` parses correctly and all required fields are present.
- Every path listed in `contributions` exists on disk.
- Every `SKILL.md` in `skills/` has `name` and `description` frontmatter.
- Every capability ref in `requiresCapabilities` is syntactically valid.
- The declared `executionZones` are all known built-in zones.

Fix any errors before submitting to the Biome Studio or the Xema Store.

---

## Installing into a sandbox

During development, install the biome into a sandbox environment to test in isolation:

```bash
xema biome install ./acme-code-review --environment sandbox
```

This creates a `sandbox-installed` biome. The sandbox environment has no access to org secrets or external connectors. Use mock connectors during development:

```bash
xema connector mock scm --name my-mock-repo
```

---

**Previous**: [← Concepts](./01-concepts.md)

**Next**: [Store →](./03-store.md)
