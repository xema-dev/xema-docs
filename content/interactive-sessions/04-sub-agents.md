# Sub-agents (Delegates)

A **sub-agent** is an agent the primary agent can hand off a focused task to mid-turn. The primary stays in charge of the conversation; the sub-agent runs in a child execution context, completes its task, and returns a summarised result.

Sub-agents are how a session stays focused while still doing breadth-heavy work — codebase exploration, web research, build verification, standards lookup — without polluting the primary's working memory.

---

## What is a sub-agent?

A sub-agent is **just an agent** with a default role hint of `subagent` instead of `primary`. The role is decided at *binding time* by the consumer (your session, your workflow step), not at definition time:

- **The same agent slug** can serve as a primary in one session and as a sub-agent in another.
- **Biomes ship agents**, and any agent with `mode: subagent` in its frontmatter becomes available as a sub-agent across the platform.
- **The primary delegates** by calling the built-in `task` tool; the platform opens a fresh child session for the sub-agent, runs it, and returns the final response to the primary.

---

## Where sub-agents come from

Four layers compose the effective sub-agent set for any session or workflow step. Lower layers establish a floor; higher layers add to it (sub-agents are additive — no layer can remove a slug a lower layer declared).

| Layer | Source | When applied |
|---|---|---|
| **Intrinsic floor** | The primary agent's own manifest declares `permission.task: <slug>: allow` for each delegate it expects to use. | Always. Cannot be removed at the session/step level. |
| **Workspace manifest** | `agent.subAgents[]` in the bound workspace manifest (a versioned template like `engineering-standard@1.1.0`). | Whenever that manifest is mounted. |
| **Interactive session profile** | `defaultSubAgents` on the profile. | Every session created from the profile. |
| **Session / workflow step** | `Session.subAgentBindings` (set via the Delegates panel) or DSL `with.subAgents` on a workflow step. | Per session or per step. |

Same-slug collisions across layers resolve by **highest-layer-wins** for the model override. The slug stays mounted exactly once.

---

## Attaching sub-agents to an interactive session

Open the session, expand the **Tools** drawer, and use the **Delegates** section.

- The list shows the *effective* set — intrinsic delegates appear with a lock icon and a "from agent definition" label. You can refine their model but you cannot unmount them.
- Click **Add delegate** to pick from the agents your organization has visible. Biomes and org-authored agents both appear here.
- Each binding has its own optional model override (Strategy or Pinned model). Leaving it blank means the delegate inherits the primary's model on every invocation.

Detaching only removes session-level bindings. Intrinsic / manifest / profile bindings stay regardless.

### API

```bash
# Attach
curl -X POST https://agent-session-api.xema.dev/sessions/{sessionId}/subagents \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "web-explorer",
    "modelOverride": { "kind": "strategy", "modelClass": "utility" }
  }'

# Refine the model on an existing or intrinsic binding
curl -X PATCH https://agent-session-api.xema.dev/sessions/{sessionId}/subagents/web-explorer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "modelOverride": null }'

# Detach a non-intrinsic binding
curl -X DELETE https://agent-session-api.xema.dev/sessions/{sessionId}/subagents/web-explorer \
  -H "Authorization: Bearer $TOKEN"
```

`DELETE` on an intrinsic slug returns `400` — intrinsics are the floor.

---

## Model overrides

Every binding accepts an optional `ModelRef`:

```yaml
# Pin a concrete model
modelOverride:
  kind: concrete
  modelId: anthropic/claude-haiku-4-5-20251001
  providerSlug: anthropic       # optional disambiguation

# Route through a strategy
modelOverride:
  kind: strategy
  modelClass: utility            # coding | review | creative | planning | utility
```

- **Concrete** pins the sub-agent to a specific credentialed model. Re-resolution is a no-op until you change the binding.
- **Strategy** routes the request through the named model class. Rebinding the strategy (e.g. CODING is re-pointed at a different model) takes effect on the next invocation with no edits to the session or workflow.
- **No override** lets the sub-agent inherit the primary's resolved model at invocation time.

---

## Sub-agents in workflows

The `xema/agent` action step accepts a `subAgents` input — same shape as the session-level binding, applied for that step only.

```yaml
jobs:
  engineering:
    uses: xema/agent
    with:
      agentSlug: engineering
      subAgents:
        - slug: build-verifier
        - slug: web-explorer
          model:
            kind: concrete
            modelId: anthropic/claude-haiku-4-5-20251001
```

The Workflow Designer's Inspector exposes the same fields as form controls — see [DSL: Agent Step](../dsl/06-agent-step.md).

---

## How invocation works

1. The primary agent decides it needs help and calls the `task` tool with the sub-agent slug and prompt.
2. The Xema Agent Runtime opens a child session for that sub-agent.
3. The child session runs to completion in its own execution context with its own (possibly overridden) model.
4. The child's final response is returned to the primary as the `task` tool result.
5. Conversation continues; the primary keeps the focused, summarised answer rather than the full back-and-forth.

The session event ledger records both the primary's `tool_call_started` for `task` and the child session's lifecycle events, so the audit trail is complete.

---

## Designing a good sub-agent

Sub-agents shine when their job is **narrow, repeatable, and side-effect-light**:

- **Discovery**: codebase exploration, standards lookup, API documentation retrieval.
- **Verification**: build verification, lint runs, security scans on a small change set.
- **Synthesis**: summarising a long document into a few decisions, drafting a one-line commit message from a diff.

They are a poor fit for tasks that need long-running multi-step state, share mutable resources with the primary, or require the same broad context the primary already has.

---

**Previous**: [← API Reference](./03-api-reference.md)
**Next**: [Agent Step in the DSL →](../dsl/06-agent-step.md)
