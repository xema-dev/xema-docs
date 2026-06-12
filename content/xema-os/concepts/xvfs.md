---
slug: xvfs
title: XVFS (Xema Virtual File System)
summary: A read-mostly hierarchical namespace that exposes every addressable Xema entity as a path. Concepts live at `/system/concept/<slug>`, capabilities at `/system/capability/<owner>/<verb>`, objects at scope-prefixed paths. XVFS makes the platform browsable, scriptable, and reflectable.
relatedCommands: ["xema explain", "xema inspect"]
relatedCapabilities: ["xema-shell:explain@1", "xema-shell:inspect@1"]
relatedZones: []
stability: stable
---

XVFS is Xema's reflection plane. Every [object](./object.md) the
platform owns — a [skill](./skill.md), a [workflow](./workflow.md), a
[concept](#), a [capability](./capability.md) — is reachable via a
deterministic path. The scope prefix mirrors the
[scope tier](./object.md) of the object: `/system/...` for kernel-shipped
entities, `/orgs/<id>/...` for tenant-scoped, `/users/<id>/...` for
user-scoped. The [xema-shell](./xema-shell.md) `explain`, `inspect`,
and `ls` commands all walk XVFS. Resolution is delegated to the Object
Registry — XVFS does not store anything itself; it is a typed view over
the registry plus the kernel's built-in object kinds.
