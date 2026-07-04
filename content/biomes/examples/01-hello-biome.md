# Example: Hello Biome

> **Complexity**: Starter
> **Contributions**: one workflow, one skill
> **Capabilities required**: `kb:page.write@1`

A minimal biome that runs a single workflow and uses a skill. No backend service, no frontend contributions, no connectors. The smallest possible thing that works end-to-end.

---

## Goal

When triggered manually, the biome runs a workflow that uses the `hello-skill` to draft a short greeting and saves it to the knowledge base.

---

## File layout

```
hello-biome/
  xema-biome.json
  skills/
    hello-skill/
      SKILL.md
  workflow-config/
    hello.yaml
```

---

## `xema-biome.json`

```json
{
  "name": "@acme/hello-biome",
  "version": "0.1.0",
  "xema": {
    "id": "hello-biome",
    "displayName": "Hello Biome",
    "description": "A minimal starter biome for learning the authoring model.",
    "scope": "platform",
    "target": "server",
    "engines": { "xema": "^1.0.0" },
    "requiresCapabilities": ["kb:page.write@1"],
    "permissions": {
      "defaultProfile": "internal-agent",
      "hints": [
        {
          "capability": "kb:page.write@1",
          "reason": "Saves the generated greeting to the knowledge base.",
          "riskTier": "low"
        }
      ]
    }
  }
}
```

The skill and workflow are not declared anywhere — they are discovered from the `skills/` and `workflow-config/` convention directories by on-disk presence.

---

## `skills/hello-skill/SKILL.md`

```markdown
---
name: hello-skill
description: Teaches the agent to write a friendly, personalized greeting for a given audience.
---

# Hello Skill

## Audience

You are writing for a technical audience that values clarity and brevity.

## Greeting format

- One sentence of welcome.
- One sentence describing what Xema can help them accomplish.
- Sign off with the org name.

## Example

> Welcome to Acme's Xema workspace.
> Here you can run code reviews, generate specs, and collaborate with your AI team.
> — Acme Engineering
```

---

## `workflow-config/hello.yaml`

```yaml
apiVersion: workflow/v1alpha1
kind: Workflow
metadata:
  name: hello-workflow
  slug: hello-biome/hello
spec:
  trigger:
    kind: manual
  inputs:
    audienceName:
      type: string
      description: "Name of the audience to greet"
  steps:
    - name: draft-greeting
      kind: agent
      with:
        skill: hello-skill
        prompt: |
          Draft a greeting for: {{ inputs.audienceName }}
      output:
        as: greeting
    - name: save-to-kb
      kind: capability
      with:
        ref: kb:page.write@1
        input:
          title: "Greeting for {{ inputs.audienceName }}"
          content: "{{ steps.draft-greeting.greeting }}"
```

---

## Run it locally

```bash
# 1. Run the workspace boundary checks
xema biome lint

# 2. Boot the platform with your workspace biomes — local sources always win
xema dev
```

Then trigger the `hello-biome/hello` workflow from the Workflows page with `audienceName: "Engineering Team"` and watch the greeting land in the knowledge base.

---

## What to change for a real biome

- Add `connector:scm.create-pull-request@1` to `xema.requiresCapabilities` (with a matching `permissions.hints[]` entry) and use it in a step.
- Add an agent definition under `agents/<slug>.md` and declare it in `xema.agents[]`.
- Extend `SKILL.md` with richer reference material relevant to your domain.

---

**Previous**: [← Examples Overview](./index.md)
