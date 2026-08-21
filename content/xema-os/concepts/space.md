---
slug: space
title: Space
summary: The one ownership address in Xema — who owns a row, and which of two rows at the same slug wins. `SpaceKind` is a closed seven-tier vocabulary addressed by a `xema://` `SpaceRef`; registries that own fewer tiers declare an admissible subset over it rather than a private enum of their own.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: stable
---

A Space answers *where does this thing live and who owns it*. Every
typed [object](./object.md) is anchored to exactly one, addressed by a
`SpaceRef` — a `xema://` URI whose segments are `<plural-kind>/<id>`:
`xema://system`, `xema://orgs/acme/projects/billing`,
`xema://biomes/<biomeId>`, `xema://users/<userId>`.

`SpaceKind` is closed and has seven members: `system`, `org`,
`project`, `app`, `session`, `biome`, `user`. There is no second
ownership enum anywhere in the platform. A registry that legitimately
owns fewer tiers — credentials own four, execution targets own two —
declares an **admissible subset** over this one enum and fails fast on
anything outside it. That keeps the *address* universal, which is what
makes re-scoping expressible at all: with a private enum per registry
there is no address a "publish this to my organization" request could
name.

Two facts are deliberately separate. The **tree** (`system` at the
root, `org → project → app` nesting, and `user`, `session`, `biome`
as sibling roots) answers what contains what. It cannot rank a
biome-owned row against an org-owned one, because those two share only
the root. So the **merge order** — which of two rows at one slug wins —
is its own declared rank map, `app` most specific through `system`
least, and never derived from the ancestor walk. Where the tree speaks
the two agree; where it is silent the ladder supplies.

Each Space also carries a `DataClassification` ceiling that a
descendant may raise and never lower. See the
[Spaces page](../spaces.md) for the URI grammar, the classification
set, and the re-scope operation.
