# Skills

> API Docs: https://skill-registry-api.xema.dev/api/docs

A **skill** is a folder bundle that teaches an agent how to do something. Skills are the primary way to give agents domain knowledge, style guides, reference material, and specialized instructions without modifying the agent definition itself.

Skills are owned by `skill-registry-api`, resolved through a five-tier slice of the one Space ownership model, and mounted into agent workspaces at runtime.

## Quick Links

| Page | What it covers |
|---|---|
| [Concepts](./01-concepts.md) | Space ownership, `SkillLayer`, `SkillSourceKind`, the SKILL.md contract |
| [Authoring](./02-authoring.md) | Writing skill bundles, sub-skills, slash commands |

## Getting Started

1. **[Concepts](./01-concepts.md)** — understand scope resolution before authoring.
2. **[Authoring](./02-authoring.md)** — write and validate your first skill bundle.
3. See **[Biomes → Authoring](../../biomes/02-authoring.md)** to contribute skills through a biome.

## FAQ

**Q: What is the difference between a skill and a prompt?**
A: A skill is a *folder*. It can contain multiple files — reference docs, style guides, code samples, sub-skills — that the agent can navigate. A single system-prompt string is a flat, unnavigable blob; a skill is a structured knowledge bundle.

**Q: Can an agent have multiple skills?**
A: Yes. An agent can hold any number of skills. Every resolved skill is mounted into the agent's workspace as a complete bundle, one directory per skill slug, and the agent runtime discovers them from the filesystem — there is no per-skill registration step.

**Q: Can a skill contain code that runs?**
A: Skills are knowledge bundles, not executable scripts. They contain Markdown, reference files, and sub-skills. Executable logic belongs in tools or workflow steps.
