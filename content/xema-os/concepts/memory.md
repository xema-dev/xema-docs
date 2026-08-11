---
slug: memory
title: Memory
summary: The structured, scoped, recall-able knowledge plane. Memory is owned by `memory-api`; nodes and edges are written through typed write paths and recalled by agents through capabilities. Memory is NOT free-form notes — every node has a kind, scope, and provenance.
relatedCommands: ["xema concept --include-memory"]
relatedCapabilities: ["memory:recall@1", "memory:store@1"]
relatedZones: ["org"]
stability: stable
---

Memory is how Xema gives [agents](./agent.md) durable, scoped context
without re-uploading every prompt. Each memory node is typed, scoped
to a [tier](./object.md) (system / org / project / user), and carries
provenance (`writtenBy`, `writtenAt`, `digest`). Agents recall memory
through the `memory:recall@1` capability — never through raw blob
reads — so every recall is audited and gated. Digest gates keep writes
cheap: a maintenance pass on an unchanged node consumes zero tokens.
