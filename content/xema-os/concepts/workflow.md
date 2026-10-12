---
slug: workflow
title: Workflow
summary: A declarative DSL document compiled into a deterministic execution graph of phases, jobs, gates, and artifact emissions. Workflows are owned by `workflow-engine-api` and executed by the Xema workflow worker service on the Xema Workflow Runtime. A workflow may invoke compositions as job steps.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: stable
---

A workflow is the structural backbone of automated work in Xema. It is
written in the `@xemahq/dsl` grammar, compiled to a typed IR,
and executed on the Xema Workflow Runtime. Each job in the workflow may call an
[agent](./agent.md) or a full [composition](./composition.md), emit
[artifacts](#), pass through a gate, or branch on matrix outputs.
Phases are structural — they sequence jobs and stamp `phaseKey` on
emitted artifacts — but they are not a config-resolution dimension on
their own. Workflows
are first-class [objects](./object.md) (`XemaObjectKind.Workflow`) and
biomes ship them through [contributions](./contribution.md).

## Calling constrained capabilities

A step that calls a capability marked `callerConstraint: "workflow-step"` runs as one
of the biome's own components. A biome that declares components and contributes
workflows names that component in `workflowConfig.runAs`:

```json
{
  "xema": {
    "workflowConfig": { "runAs": "mailops-api" }
  }
}
```

`runAs` is a component key (a service or worker the biome declares). A content-only
biome declares no components, omits `runAs`, and its constrained calls are refused with
`CAPABILITY_CALLER_CONSTRAINT_UNMET`. Workflows contributed by store biomes are not
admitted.

Each constrained call carries a per-call **step credential** minted for the target's
receiver audience (see [capability](./capability.md)).

A run started under an org delegation asserts the delegate (`delegation.actor`) as the
caller. `authorizedBy` is provenance only and never grants authority. Every call is
capped by the delegation's `lend`.
