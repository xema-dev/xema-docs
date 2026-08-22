---
slug: skill
title: Skill
summary: A folder bundle that teaches an agent *how* to do something. The only strict file is `SKILL.md` with frontmatter (`name`, `description`); the rest of the bundle — reference docs, scripts, assets, sub-skills — is free-form. Skills are owned by `skill-registry-api` and resolved over `SKILL_SPACE_KINDS`, an admissible subset of the one `SpaceKind` ownership vocabulary — most-specific wins.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: stable
---

A skill is a folder, not a file. `SKILL.md` carries the contract;
everything else is mounted as-is into the agent workspace, one
directory per skill slug, and discovered from the filesystem by the
agent runtime. Skills are hierarchical
(recursive sub-skills), multi-resource, and sourced from a biome's
`skills/` folder, the Agent Studio, or a registered git repository.
They are owned by `skill-registry-api` and addressed as
`XemaObjectKind.Skill`. Availability is implicit in ownership: a skill
is owned at a [space](./space.md), and the registry declares
`SKILL_SPACE_KINDS` — the admissible subset `system`, `biome`, `org`,
`project`, `user` over the one seven-member `SpaceKind` vocabulary —
rather than an ownership enum of its own. Two skills at one slug are
collapsed by the declared `SPACE_KIND_RANK` ladder, most-specific
winning, and a skill reaches a broader audience by re-scoping
(`POST /skills/:id/rescope`), never through a binding table. See
[Skills / Authoring](../skills/02-authoring.md) for the bundle authoring
contract and the resolution model.
