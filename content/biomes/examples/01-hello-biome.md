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
  workflows/
    hello.yaml
```

---

## `xema-biome.json`

```json
{
  "name": "hello-biome",
  "version": "0.1.0",
  "displayName": "Hello Biome",
  "description": "A minimal starter biome for learning the authoring model.",
  "lifecycle": "draft",
  "requiresCapabilities": [
    "kb:page.write@1"
  ],
  "permissionHints": {
    "kb:page.write@1": "Saves the generated greeting to the knowledge base."
  },
  "defaultProfile": "internal-agent",
  "contributions": {
    "skills": ["skills/hello-skill/"],
    "workflows": ["workflows/hello.yaml"]
  },
  "executionZones": ["org"],
  "uninstallPolicy": "delete"
}
```

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

## `workflows/hello.yaml`

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
# 1. Validate
xema biome validate ./hello-biome

# 2. Install in sandbox
xema biome install ./hello-biome --environment sandbox

# 3. Trigger the workflow
xema workflow run hello-biome/hello \
  --input audienceName="Engineering Team" \
  --environment sandbox
```

---

## What to change for a real biome

- Add `connector:scm.create-pull-request@1` to `requiresCapabilities` and use it in a step.
- Add an agent definition under `agents/` with `intrinsicSkills: ["hello-skill"]`.
- Extend `SKILL.md` with richer reference material relevant to your domain.

---

**Previous**: [← Examples Overview](./index.md)
