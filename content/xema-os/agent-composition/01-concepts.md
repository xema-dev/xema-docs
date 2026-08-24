# Agent Concepts

Xema has **one Agent primitive**. An Agent carries its own identity, prompt, intrinsic Skills and Tools, optional inheritance, workspace policy, capability envelope, and recursive subagents.

A leaf specialist is an Agent with no subagents. A multi-agent composition is an Agent with subagents. They share one identity model, revision model, authoring path, and resolver.

---

## Agent shape

Conceptually, a published Agent contains:

```ts
interface Agent {
  slug: string;
  version: string;
  systemPrompt?: string;
  extends?: string;
  promptMode?: 'append' | 'replace';
  skills: SkillRef[];
  tools: ToolSelectionEntry[];
  subagents: AgentNode[];
  limits?: AgentLimits;
  workspace?: AgentWorkspaceConfig;
  workspaceSharing?: 'isolated' | 'shareable';
  capability?: CapabilityLayer;
}
```

Each subagent node references another published Agent and may add node-local Skills, Tools, instructions, a model override, permission narrowing, limits, and further children.

---

## Inheritance

An Agent may `extend` one base Agent. The resolver walks the inheritance chain, rejects cycles and excessive depth, and combines configuration deterministically.

`promptMode` controls the derived Agent's prompt:

- `append` — base prompt, then the derived prompt;
- `replace` — derived prompt only.

Skills and tool configuration are resolved as part of the Agent's intrinsic layer. Invocation overlays are applied later and cannot turn a narrower permission into broader authority.

---

## Subagents

Subagents are Agents referenced recursively. The parent delegates through its task capability; the child executes in its own bounded context and returns a result.

The Agent can declare structural runtime limits such as maximum recursion depth, fan-out, and total spawns. These are runtime controls, not prompt suggestions.

---

## One Agent, two execution experiences

The same published Agent can run as:

- an **Interactive Session**, with streaming, threads, pause/resume, attachments, and human collaboration;
- a **Workflow Agent step**, with durable orchestration, retry policy, structured deliverables, and optional human-in-the-loop handoff.

The Agent definition stays the same. The launch surface supplies the interaction and lifecycle mode.

---

## Identity, drafts, revisions, and rollback

Agent storage separates:

- a stable Agent identity;
- one mutable draft;
- immutable, content-addressed published revisions;
- a live pointer to the active revision.

Publishing creates a new immutable revision. Restoring copies an earlier revision into the mutable draft. Rolling back moves the live pointer to an existing immutable revision and creates no new content.

Retirement is an identity operation: the active pointer is cleared. Runtime resolution follows published revisions, never an editable draft, except in the explicit authoring sandbox.

---

## Agent references

Use a bare slug to resolve the latest live published revision, or `slug@version` to pin a specific published version. Production Workflows should use or compile to immutable pins so replays remain deterministic.

---

**Next**: [Model Resolution →](./02-model-resolution.md)
