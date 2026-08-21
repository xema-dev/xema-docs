---
slug: skill
title: Skill
summary: A folder bundle that teaches an agent *how* to do something. The only strict file is `SKILL.md` with frontmatter (`name`, `description`); the rest of the bundle — reference docs, scripts, assets, sub-skills — is free-form. Skills are owned by `skill-registry-api` and resolved through a five-tier slice of the one `SpaceKind` ownership model.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: stable
---

A skill is a folder, not a file. `SKILL.md` carries the contract;
everything else is mounted as-is into the agent workspace at
`/workspace/.xema/skills/<slug>/`. Skills are hierarchical
(recursive sub-skills), multi-resource, and sourced from a biome's
`skills/` folder, the Agent Studio, or a registered git repository.
They are owned by `skill-registry-api` and addressed as
`XemaObjectKind.Skill`. The five owning tiers (system / biome / org /
project / user) determines availability — more-specific wins. See
[Skills / Authoring](../skills/02-authoring.md) for the bundle authoring
contract and the resolution model.
