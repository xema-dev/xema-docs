---
slug: xema-shell
title: Xema Shell
summary: The unified command surface Xema exposes to both humans and agents. Every action — built-in or biome-contributed — is a Shell command that dispatches through a single capability. Agents talk to the Shell through `xema-shell:run@1`; humans talk to it through the CLI / web terminal.
relatedCommands: ["xema shell", "xema run xema-shell:help@1", "xema run xema-shell:concepts.list@1"]
relatedCapabilities: ["xema-shell:run@1", "xema-shell:help@1"]
relatedZones: ["system"]
stability: stable
---

The Xema Shell is the deterministic, capability-backed command plane.
It is *not* a Unix shell — it has no string-eval, no pipes, no fork.
Every command is a typed `ShellCommandDescriptor` (name, syntax,
required [capabilities](./capability.md), required
[execution environments](./execution-environment.md), output schema). Built-in commands are
shipped by `xema-shell-api`; biome-contributed commands are declared
through the [contribution](./contribution.md) protocol. The agent-
facing capability `xema-shell:run@1` takes a structured `argv: string[]`
and always returns JSON — the same path the human shell uses, with
`--json` forced on.
