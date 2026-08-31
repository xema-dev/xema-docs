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
  limits?: AgentLimits;   // declared; not enforced today — see Subagents
  workspace?: AgentWorkspaceConfig;
  workspaceSharing?: 'isolated' | 'shareable';
  capability?: CapabilityLayer;
}
```

Each subagent node references another published Agent and may add node-local Skills, Tools, instructions, a model override, permission narrowing, and further children.

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

### What bounds a tree

Two bounds apply, and it is worth being precise about which is which.

**The platform caps the shape of the tree, at publish time.** A subagent tree may not exceed **6 levels of nesting** or **64 nodes in total**, and sibling nodes under one parent must carry distinct aliases. A tree that breaks any of those is rejected with a `400` when you save it — so an unbounded or ambiguous composition never reaches the runtime in the first place. Inheritance is bounded the same way: an `extends` chain that forms a cycle, or that runs deeper than 32 links, is refused.

These are fixed platform bounds. They are not per-Agent settings, and you do not configure them.

**Spend is capped against the organization's balance, not per run.** Model usage is metered as it happens; when the balance is exhausted, a request is refused before it reaches the model provider, and a response already streaming is cancelled mid-generation. That is a real ceiling and it is the one that stops runaway cost — but it is an account-level ceiling. It does not cap a single run, a single Agent, or a single subagent subtree.

> **`limits` is a declared field, not yet an enforced one.** The `Agent` contract carries an optional `limits` object (`maxDepth`, `maxFanout`, `maxSpawns`, `tokenBudget`). Nothing in the runtime reads it today, so setting it changes no behaviour. Do not rely on it as a control; use the platform bounds above, and the balance ceiling, and size the tree deliberately. This page will say so plainly until that changes.

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
