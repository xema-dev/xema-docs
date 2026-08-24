---
slug: agent
title: Agent
summary: The unified actor primitive: identity, prompt, intrinsic Skills and Tools, inheritance, workspace policy, and an optional recursive subagent tree.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: stable
---

An **Agent** is one of the four primitives of the Xema Agent runtime. It has a stable identity, one mutable draft, immutable published revisions, a prompt, intrinsic [Skills](./skill.md), intrinsic [Tools](./tool.md), and optional recursive subagents.

An Agent may extend one base Agent and append or replace its prompt. A leaf Agent has no subagents; a multi-agent composition is the same Agent shape with subagents. The runtime does not store these as different primitives.

The same published Agent can be launched in an Interactive Session or used as a Workflow step. The Model Resolution Matrix selects the model at invocation boundaries, while the capability layer, reach ceiling, and current policy constrain what the Agent can do.

Agents are owned in a [Space](./space.md). A bare ref resolves the current live published revision; a versioned ref pins an immutable revision.
