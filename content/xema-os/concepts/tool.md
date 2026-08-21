---
slug: tool
title: Tool
summary: An executable capability exposed to an agent — typically an MCP server endpoint, a built-in workspace action, or a platform RPC. Tools are owned by `llm-registry-api` (selection) and `mcp-catalog` / `mcp-gateway-api` (transport).
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org", "sandbox"]
stability: stable
---

A tool is what an [agent](./agent.md) calls when it needs to do
something the model alone cannot do — read a file, query a service,
invoke a workflow. Tool selection is part of the agent's intrinsic
definition or attached at an [composition](./composition.md) node. The
[mcp-catalog](#) is the runtime-injectable index; the mcp-gateway
brokers the actual transport with authentication and audit. Like every
other primitive, tools are owned at a [space](./space.md) — an
admissible subset of the one `SpaceKind` vocabulary, collapsed by the
declared `SPACE_KIND_RANK` ladder so the most specific owner wins — and
may be shipped by biomes via [contribution](./contribution.md).
