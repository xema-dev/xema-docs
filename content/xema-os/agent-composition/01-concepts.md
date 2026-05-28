# Agent Composition Concepts

**Agent Composition** is how Xema scales a single agent into a multi-step, multi-role piece of work. Instead of hardcoding an execution order in a workflow YAML, a composition declares a tree of nodes — each node is an agent, optionally extended with extra skills, tools, and a model override.

---

## The composition tree

A composition is a tree of `CompositionNode`s. Each node has:

```ts
interface CompositionNode {
  ref: AgentRef;               // "slug@version" — the referenced agent definition
  skills?: string[];           // additional skills to mount at this node only
  tools?: string[];            // additional tools to enable at this node only
  modelOverride?: ModelRef;    // override the model for this node (not children)
  children?: CompositionNode[];// sub-agents, themselves fully-armed nodes
}
```

The root node is the entry point. Children are spawned by the root agent using the composition contract — they are not launched independently.

### AgentRef format

Agent references use a `slug@version` format:

```
reviewer@1.2.0        ← pinned version
reviewer@latest       ← always resolves the latest published version
acme/reviewer@1.2.0   ← org-qualified slug (for cross-org compositions)
```

Pinned versions are recommended for production compositions. `@latest` is convenient for development but can be unpredictable when a new version is published.

---

## Recursion — compositions of compositions

A composition node can reference an agent that is itself a composition root. This is how multi-level multi-agent pipelines are built:

```
orchestrator-agent
  ├── researcher-agent
  │     └── search-tool-agent
  └── writer-agent
        └── editor-agent
```

Each node is resolved independently. The `orchestrator-agent` does not need to know the internal structure of `researcher-agent`. This keeps compositions modular and independently testable.

---

## CompositionLifecycle

Compositions move through the same lifecycle as all Xema objects:

| State | Meaning |
|---|---|
| `draft` | Under authoring; never resolved by the runtime; free to iterate |
| `published` | Immutable; the only state the runtime resolves |
| `archived` | Retained for lineage; never resolved; existing pinned references continue working |

The state machine is **one-directional**: `draft → published → archived`. Publishing is a deliberate act; archiving is explicit. There is no auto-publish, no silent state change.

Resolution always refuses a non-`published` version — the runtime returns `COMPOSITION_NOT_PUBLISHED` and fails fast. This is intentional: production execution must always use an inspectable, immutable composition.

### Publishing a composition

Publishing requires the `composition:publish@1` capability:

```bash
xema composition publish my-composition --version 1.0.0
```

Or via the Agent Studio UI: **Agent Composition → [composition name] → Publish**.

Publishing is permanent. If the composition needs to change, create a new version and publish that.

---

## Skills and tools at node level

Skills and tools can be declared at the agent definition level (intrinsic, always present) or at the node level (extra, added for this composition only):

```json
{
  "ref": "reviewer@1.2.0",
  "skills": ["security-review", "performance-review"],
  "tools": ["mcp-tool:sonarqube.read@1"]
}
```

Node-level skills and tools are additive — they extend the agent's intrinsic set for the duration of this composition. They do not modify the agent definition itself.

---

## Interactive sessions vs workflow steps

The same published composition can be used as:

- **An interactive session agent** — launched by a human or agent via the interactive session API. The session keeps the composition resident while the conversation is active.
- **A workflow step** — referenced in a workflow YAML step with `kind: agent-composition`. The Xema workflow runtime spawns the composition, waits for output, and continues.

No code change is needed to switch between uses. The platform adjusts only the I/O surface (streaming vs synchronous output).

---

**Previous**: ← (this is the first page in this section)

**Next**: [Model Resolution →](./02-model-resolution.md)
