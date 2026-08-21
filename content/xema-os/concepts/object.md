---
slug: object
title: XemaObject
summary: The canonical addressable thing in Xema. Every object carries a stable `XemaObjectRef`, a `kind`, a `scope`, an `owner`, a `version`, a `lifecycle`, and a kind-specific `payload`. Producers project their slice into the Object Registry; consumers resolve refs through it.
relatedCommands: ["xema run xema-shell:explain@1", "xema run xema-shell:inspect@1"]
relatedCapabilities: ["xema-shell:explain@1", "xema-shell:inspect@1"]
relatedZones: []
stability: stable
---

The Object Model is plane 1 of the Xema System Interface (XSI). Each
object is identified by a `XemaObjectRef` of the shape
`xema://<scope-path>/<kind>/<slug>[@<version>]`. The kind is drawn from
the closed [object-kind](./object-kind.md) enum; the scope path is
derived from the 5-tier scope ref. Object ownership is single-writer:
exactly one producing service owns each `(source, kind)` slice and
publishes a complete projection via the
`xema.object-registry.projection.published.v1` CloudEvent. Consumers
read refs through `object-registry-api`. Objects move through the
[lifecycle](./lifecycle.md) `draft → published → archived`; only
`published` versions can be resolved. See the kernel
package `@xemahq/kernel-contracts/object`.
