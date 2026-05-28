---
slug: agent
title: Agent
summary: One of the four primitives of the Xema agent runtime — an identity bound to a prompt and a set of intrinsic skills and tools. An agent is the LLM-backed actor that consumes skills, calls tools, resolves models, and produces work in workflows or interactive sessions.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: stable
---

An agent is a typed actor: identity + system prompt + intrinsic
[skills](./skill.md) and [tools](./tool.md). Agents are owned by
`llm-registry-api` and addressed as `XemaObjectKind.Agent`. At
invocation time the Model Resolution Matrix picks the concrete model
based on the agent, skill, project, and (optionally) workflow phase.
An agent is usable two ways: as a sub-agent inside an
[composition](./composition.md), or as the root of an interactive
session. The set of agents is open and extensible — biomes ship their
own through [contributions](./contribution.md). See plan §6 and
`.claude/rules/skills-and-composition.md` for the runtime model and
the four-primitive contract.
