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
