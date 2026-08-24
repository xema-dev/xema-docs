---
slug: composition
title: Agent Composition
summary: The recursive face of the unified Agent primitive. An Agent with subagents is a composition; an Agent without them is a leaf specialist.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: stable
---

**Agent Composition** is not a second resource model. It is the recursive face of an [Agent](./agent.md).

An Agent's subagent tree references other published Agents. Each node may add Skills, Tools, instructions, a model override, permission narrowing, and runtime limits. Children can have children, so a coordinator can delegate to specialists while remaining one published, inspectable Agent definition.

The same definition works in an Interactive Session and a Workflow Agent step. Published resolution pins every referenced revision and fails fast on missing refs, cycles, invalid inheritance, or unsatisfied requirements.
