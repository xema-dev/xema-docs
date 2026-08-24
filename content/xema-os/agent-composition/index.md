# Agent Composition

> API Docs: https://llm-registry-api.xema.dev/api/docs

Xema has **one Agent primitive**. A leaf specialist is an Agent with no subagents; a multi-agent composition is the same Agent shape with a recursive subagent tree. The same published Agent powers Interactive Sessions and Workflow steps — there is no separate session-Agent, workflow-Agent, kernel-Agent, or composition storage model.

Agent Composition replaces the old single-agent-per-phase model. The **Model Resolution Matrix** picks the right model for each node at invocation time based on declared dimensions — no hardcoded phase-to-model mapping.

## Quick Links

| Page | What it covers |
|---|---|
| [Concepts](./01-concepts.md) | The unified Agent, inheritance, recursion, revisions, and execution experiences |
| [Model Resolution](./02-model-resolution.md) | ModelResolutionRule, dimensions, priority, debugging |

## Getting Started

1. **[Concepts](./01-concepts.md)** — understand the unified Agent, recursive nodes, and revision lifecycle.
2. **[Model Resolution](./02-model-resolution.md)** — configure which model each node uses.
3. Build and publish Agents in **Agent Studio** or through the Agent authoring API.

## FAQ

**Q: Can I use Agent Composition for both interactive sessions and automated workflows?**
A: Yes. The same published Agent can be launched as an interactive session or as a workflow step. The launch surface changes the interaction and lifecycle behavior, not the Agent definition.

**Q: What happens if an Agent references an unpublished subagent?**
A: Published resolution fails fast rather than silently selecting a draft. Draft resolution is limited to the explicit authoring sandbox.

**Q: Can the model change mid-turn?**
A: No. The Model Resolution Matrix resolves the model at invocation boundaries only: agent start, sub-agent spawn, and `/skill` launch. The model is fixed for the duration of a turn.
