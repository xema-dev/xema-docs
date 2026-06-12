---
slug: composition
title: Agent Composition
summary: The recursive workflow-as-agent primitive. A composition is an Agent armed with Skills and Tools whose children are themselves fully-armed composition nodes. The same composition shape powers interactive sessions and Xema workflow steps.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: stable
---

Agent Composition is how Xema scales a single [agent](./agent.md) into
a multi-step, multi-role piece of work without splitting the model into
session-vs-workflow forms. A composition node references an agent by
`slug@version`, attaches optional extra [skills](./skill.md),
[tools](./tool.md), and a `modelOverride`, and lists child nodes that
are themselves compositions. Compositions move through the
[lifecycle](./lifecycle.md) — only `published` compositions can be
resolved. The Model Resolution Matrix resolves the model per node at
invocation boundaries (start, sub-agent spawn, `/skill` launch) and
never mid-turn. Publishing a composition is a dedicated capability
call (`composition:publish@1`), dispatched through the
[Xema Shell](./xema-shell.md).
