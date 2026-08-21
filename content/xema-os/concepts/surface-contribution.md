---
slug: surface-contribution
title: "Surface Contribution"
summary: "The manifest a biome ships to register a render kind a Vista preview tab can hold: a biome-local kind slug, a payload JSON Schema, and display metadata. The first-party kind set is closed; biome kinds are namespaced so they can never shadow it."
relatedCommands: ["xema biome install", "xema biome publish"]
relatedCapabilities: []
relatedZones: []
stability: stable
---

<!--
  AUTO-GENERATED — DO NOT EDIT BY HAND.
  Generator: tooling/codegen/generate-extension-surface-concepts.mjs
  Source of truth: SurfaceContributionManifestSchema, SurfaceKind, SurfaceKindSource (@xemahq/kernel-contracts/surface)
  Regenerate from the aggregator repo root:
    pnpm run docs:extension-surface
-->

Contribution kind: `surface-kind`. Ingestion: biome-host parser (`SurfaceKindParser`).

A **surface** is what the agent opens in a preview tab. A biome contributes its own
render kind so its frontend can register a renderer for it. The catalogue namespaces
the declared slug to `<biomeId>:<kind>`, so a biome can never claim a bare first-party
kind. Provenance is stamped by the ingestion pipeline, not declared inline.

This shape is structurally identical to a widget-kind contribution on purpose: the
in-chat widget plane and the render plane share one contribution shape, one frontend
registry core, and one renderer fallback chain.

## `manifest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | string | yes | max 100 chars; pattern `/^[a-z][a-z0-9-]*$/` |
| `version` | number | yes | integer; > 0 |
| `displayName` | string | yes | max 200 chars |
| `summary` | string | yes | max 1000 chars |
| `payloadSchema` | map<string, unknown (free-form JSON)> | yes | — |

## First-party kinds (closed set)

These slugs are reserved by the frontend registry. A biome kind is always namespaced,
so contributing one of these bare names is impossible by construction.

| Kind | |
|---|---|
| `url` | `SurfaceKind.Url` |
| `web` | `SurfaceKind.Web` |
| `html` | `SurfaceKind.Html` |
| `markdown` | `SurfaceKind.Markdown` |
| `code` | `SurfaceKind.Code` |
| `diff` | `SurfaceKind.Diff` |
| `json` | `SurfaceKind.Json` |
| `table` | `SurfaceKind.Table` |
| `chart` | `SurfaceKind.Chart` |
| `pdf` | `SurfaceKind.Pdf` |
| `image` | `SurfaceKind.Image` |
| `media` | `SurfaceKind.Media` |
| `object` | `SurfaceKind.Object` |
| `biome-route` | `SurfaceKind.BiomeRoute` |
| `form` | `SurfaceKind.Form` |
| `app` | `SurfaceKind.App` |
| `files` | `SurfaceKind.Files` |
| `graph` | `SurfaceKind.Graph` |

18 first-party kinds. Adding one is a kernel enum member plus a
renderer registered into the frontend registry's closed set — not a contribution.

## Provenance

A catalogue entry declares where it came from:

- `first-party` (`SurfaceKindSource.FirstParty`)
- `biome` (`SurfaceKindSource.Biome`)

## Related concepts

- [contribution-kind](./contribution-kind.md) — the full catalog
- [object](./object.md) — what a surface most often renders
- [extension-surface](./extension-surface.md) — the three extension channels
