# Subagents

A **subagent** is another published Agent referenced from an Agent's recursive `subagents` tree. It is not a separate primitive or a special session profile.

The parent remains responsible for the overall interaction. It delegates a focused task, the child runs in a bounded execution context, and the result returns to the parent.

---

## Where subagents are defined

The authoritative subagent tree is part of the published Agent revision. Each node references another Agent by slug and optional version pin.

A node can add:

- an alias;
- extra Skills;
- extra Tools;
- appended instructions;
- a model override;
- permission narrowing;
- recursive children;
- structural runtime limits.

Invocation overlays can refine the launch where the contract allows, but they do not create a second profile-based composition model and cannot broaden authority beyond the published and policy-controlled ceilings.

---

## Model resolution

A subagent can:

- inherit the parent invocation's resolved model behavior;
- carry a concrete model override;
- route through a model strategy such as `utility`, `review`, or `planning`.

Model resolution happens at invocation boundaries, including subagent spawn. The selected model does not change unpredictably in the middle of a turn.

---

## Runtime limits

An Agent can declare limits for its recursive work:

- maximum depth;
- maximum concurrent fan-out;
- maximum total spawns;
- optional token budget where supported by the launching runtime.

Depth, fan-out, and spawn limits are enforced by the runtime. They are not advisory text in the system prompt.

---

## In Interactive Sessions

The session resolves the published Agent revision and its full recursive tree at launch. The parent can delegate through its task capability. Session events record the parent tool call and child execution lifecycle so the work remains inspectable.

The Session supplies real-time conversation, workspace, thread, and lifecycle behavior; the Agent supplies the composition.

---

## In Workflows

The `xema/agent` action names the primary Agent with `agentRef`. Its current action contract also supports per-step subagent bindings and coordinator limits where a Workflow needs a narrower or more explicit launch envelope.

```yaml
jobs:
  investigate:
    uses: xema/agent
    with:
      agentRef: incident-coordinator@3
      deliverableSpecRef: incident-report@1
      agentContext:
        prompt: Investigate the incident and return a verified action plan.
      subAgents:
        - slug: policy-researcher
          modelOverride:
            kind: strategy
            modelClass: utility
      composition:
        limits:
          maxDepth: 3
          maxFanout: 4
          maxSpawns: 12
```

---

## Good subagent design

Use subagents for bounded specialist work: research, verification, synthesis, comparison, or provider-specific analysis. Keep shared mutable state and broad orchestration with the parent or a durable Workflow.

---

**Previous**: [← API Reference](./03-api-reference.md)
**Next**: [Agent Step in the DSL →](../dsl/06-agent-step.md)
