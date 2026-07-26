---
slug: search-type-contribution
title: "Search Type Contribution"
summary: "The manifest a biome ships to register a search result-type: the object kind and facet it covers, render and deep-link hints, the searchable-field set, the embedding-eligibility default, and the authorization mapping. Result-types are contributed at boot; document instances are event-fed at runtime."
relatedCommands: ["biome install","biome publish"]
relatedCapabilities: []
relatedZones: []
stability: stable
---

<!--
  AUTO-GENERATED — DO NOT EDIT BY HAND.
  Generator: tooling/codegen/generate-extension-surface-concepts.mjs
  Source of truth: SearchTypeContributionManifestSchema (@xemahq/kernel-contracts/search)
  Source of truth: SearchRouteTemplateVariable + SEARCH_ROUTE_TEMPLATE_VARIABLE_SOURCE (same subpath)
  Regenerate from the aggregator repo root:
    pnpm run docs:extension-surface
-->

Contribution kind: `search-type`. Ingestion: biome-host parser (`SearchTypeParser`).

A **result-type** is the `(objectKind, docType)` facet a biome makes searchable. It is
declarative and boot-time. Document INSTANCES are a separate, runtime, event-fed path —
contributing a result-type does not index anything by itself; it teaches the platform
how to render, deep-link, and authorize hits of that facet.

Contributing render hints is what makes a new biome fully renderable in search without
anyone adding a per-kind branch to the frontend.

## `manifest`

| Field | Type | Required | Notes |
|---|---|---|---|
| `objectKind` | enum | no | one of: `biome`, `app`, `app-client`, `audience-policy`, `external-subject`, `delegated-session`, `agent`, `skill`, `tool`, `model`, `model-resolution-rule`, `workflow`, `workflow-run`, `gate-action`, `connector`, `connector-binding`, `mount-source`, `artifact-type`, `artifact`, `knowledge-space`, `knowledge-page`, `document-template`, `document-theme`, `chart-runtime`, `presentation-runtime`, `widget-kind`, `capability`, `execution-environment`, `capability-grant`, `approval-rule`, `memory`, `memory-relation`, `session`, `event-stream`, `event-subscription`, `contribution-entry`, `concept` |
| `docType` | string | no | max 200 chars |
| `renderHints` | object — see **renderHints** | yes | — |
| `searchableFields` | string[] | yes | max 100 entries; entries: max 200 chars |
| `embeddingEligibleDefault` | boolean | yes | — |
| `authz` | object — see **authz** | yes | — |
| `searchReplayCapabilityRef` | string | no | pattern `/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*@\d+$/` |

### `renderHints`

| Field | Type | Required | Notes |
|---|---|---|---|
| `label` | string | yes | max 200 chars |
| `icon` | string | no | max 200 chars |
| `routeTemplate` | string | no | max 500 chars |
| `routeParams` | enum[] | no | max 2 entries; entries one of: `orgId`, `projectId`, `docType`, `objectKind`, `sourceId`, `slug`, `title`, `containerSlug` |

### `authz`

| Field | Type | Required | Notes |
|---|---|---|---|
| `resourceType` | string | yes | max 200 chars |
| `defaultVisibility` | enum | yes | one of: `owner-only`, `org-shared`, `project-shared`, `space-shared`, `explicit-share` |

## The `routeTemplate` grammar

A `routeTemplate` is a site-relative path with `{placeholder}` segments. The placeholder
vocabulary is CLOSED, and both the syntax and the SATISFIABILITY are validated at
contribution-parse time — a broken deep link is rejected at boot, never discovered in
production.

Placeholder syntax: `\{([A-Za-z0-9_]+)\}`.

### Variables

Each variable has exactly one supply route. `scope` and `identity` variables are derived
by the platform from the hit or object ref and are never declared. `projected` variables
can only come from the owning source, so a template that references one MUST declare it
in `renderHints.routeParams` — and the producer must stamp it on the indexed document.

| Variable | Source | Must be declared in `routeParams` |
|---|---|---|
| `{orgId}` | `scope` (`SearchRouteVariableSource.Scope`) | no |
| `{projectId}` | `scope` (`SearchRouteVariableSource.Scope`) | no |
| `{docType}` | `identity` (`SearchRouteVariableSource.Identity`) | no |
| `{objectKind}` | `identity` (`SearchRouteVariableSource.Identity`) | no |
| `{sourceId}` | `identity` (`SearchRouteVariableSource.Identity`) | no |
| `{slug}` | `projected` (`SearchRouteVariableSource.Projected`) | yes |
| `{title}` | `identity` (`SearchRouteVariableSource.Identity`) | no |
| `{containerSlug}` | `projected` (`SearchRouteVariableSource.Projected`) | yes |

### Rejected at parse time — syntax

| Template | Rejected because |
|---|---|
| `(empty)` | must be non-empty |
| `relative/path` | must be a site-relative path starting with "/" |
| `/a b` | must not contain whitespace |
| `/a//b` | must not contain an empty path segment ("//") |
| `/{oops` | contains a malformed placeholder — every placeholder must be "{name}" with name matching [A-Za-z0-9_]+ |
| `/{notAVariable}` | unknown placeholder "{notAVariable}" — allowed placeholders are: containerSlug, docType, objectKind, orgId, projectId, slug, sourceId, title |

### Rejected at parse time — supply contract

Enforced in both directions: a template may not reference a projected variable the
result-type does not declare, and a declared variable the template never references is a
dead declaration.

| Declaration | Rejected because |
|---|---|
| `/x/{slug}` with `routeParams: []` | placeholder "{slug}" is projected by the owning source, but this result-type does not declare it in renderHints.routeParams — the template could never expand. Either declare it (and stamp it on IndexableDocument.routeParams) or drop it from the template. |
| `/x/{orgId}` with `routeParams: ["orgId"]` | route param "orgId" must not be declared — it is supplied by the platform (source "scope"), not by the producer. Only containerSlug, slug may be declared. |
| `/x/{slug}` with `routeParams: ["slug", "slug"]` | route param "slug" is declared more than once |
| `/x/{slug}` with `routeParams: ["slug", "containerSlug"]` | route param "containerSlug" is declared but never referenced by the template — remove the dead declaration |

### Worked example

```json
{
  "renderHints": {
    "label": "Runbook",
    "routeTemplate": "/spaces/projects/{projectId}/documents/{containerSlug}/{slug}",
    "routeParams": ["containerSlug","slug"]
  }
}
```

Expanding it for a hit in project `proj_42`, container `runbooks`, slug
`incident response` yields:

```
/spaces/projects/proj_42/documents/runbooks/incident%20response
```

Every substituted value occupies a single path segment and is URL-encoded, so a value
containing `/`, `?`, `#`, or a space can never change the shape of the path. Expansion
is all-or-nothing: a missing value throws rather than emitting a half-substituted URL.

## Related concepts

- [contribution-kind](./contribution-kind.md) — the full catalog
- [object-kind](./object-kind.md) — the identity backbone every result addresses through
- [permission](./permission.md) — how the authz mapping is enforced
