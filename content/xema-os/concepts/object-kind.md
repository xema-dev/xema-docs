---
slug: object-kind
title: XemaObjectKind
summary: The closed enum of every addressable kind in the Xema universe. New kinds are added by one-line kernel PRs. Examples include `biome`, `capability`, `skill`, `agent`, `workflow`, `concept`, `mount-source`, `connector`, and `execution-environment`.
relatedCommands: ["xema concepts", "xema explain"]
relatedCapabilities: ["xema-shell:concepts.list@1"]
relatedZones: []
stability: stable
---

`XemaObjectKind` is the kernel-frozen registry of object types. It is
intentionally closed: every kind is an explicit enum value, with kebab-
case string serialization that slots directly into
[XemaObjectRef](./object.md) paths. Keeping the set closed is what lets
the platform validate refs cheaply, route capabilities deterministically,
and project each owning service's slice into the registry without
collisions. To introduce a new kind: add the enum value, define the
producer service that owns the projection, define the kind-specific
payload schema, and ship a [contribution](./contribution.md) entry.
