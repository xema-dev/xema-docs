# Agent Composition

> API Docs: https://llm-registry-api.xema.dev/api/docs

**Agent Composition** is the recursive workflow-as-agent primitive. A composition is an Agent armed with Skills and Tools whose sub-agents are themselves fully-armed composition nodes. The same composition shape powers interactive sessions and Xema workflow steps — there is no separate "session agent" vs "workflow agent" model.

Agent Composition replaces the old single-agent-per-phase model. The **Model Resolution Matrix** picks the right model for each node at invocation time based on declared dimensions — no hardcoded phase-to-model mapping.

## Quick Links

| Page | What it covers |
|---|---|
| [Concepts](./01-concepts.md) | The recursion model, `AgentRef`, and the one `AgentLifecycle` |
| [Model Resolution](./02-model-resolution.md) | ModelResolutionRule, dimensions, priority, debugging |

## Getting Started

1. **[Concepts](./01-concepts.md)** — understand the recursive node model and lifecycle.
2. **[Model Resolution](./02-model-resolution.md)** — configure which model each node uses.
3. Build compositions in **Agent Studio → Compositions** (UI) or via the `llm-registry-api` REST API.

## FAQ

**Q: Can I use Agent Composition for both interactive sessions and automated workflows?**
A: Yes. The same published composition can be launched as an interactive session (human-in-the-loop) or as a workflow step. The platform detects the context and adjusts only the I/O surface — the composition logic is identical.

**Q: What happens if a composition references an unpublished agent?**
A: Resolution fails fast rather than silently resolving the draft. Only `published` agents can be referenced in a resolved composition. (Publishing itself has its own typed refusals — `AGENT_PUBLISH_MISSING_REQUIRED_SKILLS`, `AGENT_PUBLISH_MISSING_REQUIRED_TOOLS`, `AGENT_PUBLISH_INTRINSIC_FLOOR_VIOLATION`.) Draft agents can be used in `draft` compositions for testing.

**Q: Can the model change mid-turn?**
A: No. The Model Resolution Matrix resolves the model at invocation boundaries only: agent start, sub-agent spawn, and `/skill` launch. The model is fixed for the duration of a turn.
