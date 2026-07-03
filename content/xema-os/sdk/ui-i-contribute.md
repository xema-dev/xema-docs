# SDK — UI I Contribute

A `target: "web"` biome ships its frontend as an ordinary npm-style package. Its
entry module (`src/index.tsx`) **default-exports a `FrontendBiomeFactory`** —
`(bridge: HostBridge) => FrontendBiome`. At boot the host imports that factory,
calls it with the host's `HostBridge`, and registers the returned biome so its
pages, nav items, slot panels, and session contributions light up.

You do **not** declare UI in `xema-biome.json`. The manifest only declares that
the biome is a web biome (`xema.target: "web"`) plus its id, scope, and display
metadata; every frontend contribution comes from the default-exported factory.

- **Host shell**: `xema-host-web` — a Next.js App Router app.
- **Kernel contract**: `@xemahq/ui-kernel` (published on npm). Host-rendering
  helpers (`<BiomeSlot>`, `HostExtensionSlots`, session primitives) live under
  the `@xemahq/ui-kernel/registry` subpath.

The recommended way to author a biome is the `defineWebBiome` helper — you rarely
build the `FrontendBiome` object by hand.

---

## The manifest

The web biome's `xema-biome.json` is metadata only — it never contains a
`frontend.slots` / `frontend.routes` / `frontend.nav` block. A real one:

```jsonc
{
  "name": "@xemahq/biomes-system-spaces-web",
  "version": "0.1.0",
  "xema": {
    "id": "spaces-web",
    "displayName": "Spaces (Web)",
    "display": { "icon": "layers", "category": "Workspace", "summary": "…" },
    "scope": "system",
    "target": "web",
    "systemSurface": true,
    "storeListed": false
  }
}
```

`xema.target: "web"` is what the host's build-time scanner keys on;
`xema.id` must match the `id` your factory returns. (`xema.display.category` is a
store/admin grouping label — distinct from the per-page menu `category` below.)

---

## Authoring with `defineWebBiome`

`defineWebBiome({ id, displayName, pages, … })` collapses a biome into one
declarative page list. Each page's `slug` single-sources **both** the nav route
and the route path, so they can never drift. The helper emits one route per page
(wrapping the lazily-loaded module in a `<Suspense>` boundary) and one nav item
(unless `navHidden`), and passes `init` / `dispose` / `panels` / `session` /
`outputRenderers` straight through to the `FrontendBiome`.

```tsx
import { defineWebBiome } from '@xemahq/ui-kernel';
import { Layers } from 'lucide-react';

export default defineWebBiome({
  id: 'spaces-web',
  displayName: 'Spaces',
  pages: [
    {
      slug: 'system/spaces',
      label: 'Spaces',
      icon: Layers,
      category: 'knowledge', // primary | build | operate | knowledge | admin | account
      load: () => import('./pages/SpacesPage'),
    },
  ],
});
```

Each `WebBiomePage` accepts:

| Field | Purpose |
|---|---|
| `slug` | Single source of truth for the nav route **and** the route path. May carry `:param` segments (e.g. `system/concepts/:slug`). |
| `id` | Stable nav-item id for active-state + analytics. Defaults to `slug`; set it only to keep a short id (e.g. `grants`) distinct from a longer route slug. |
| `label` | Displayed nav label. |
| `icon` | Optional nav icon (`ComponentType<{ className? }>` — any lucide/heroicons/SVG kit). |
| `category` | Semantic **menu category** the surface declares its intent to live in — see below. |
| `scope` | `'org'` (default; mounts at the org root) or `'project'` (mounts under `/spaces/projects/:projectId`). |
| `access` | Route access tier — `'member'` (default), `'org-admin'`, or `'platform-admin'`. |
| `load` | Dynamic import of the page module: `() => import('./pages/X')`. |
| `navHidden` | Register the route with **no** nav item (e.g. a `:param` detail route reached only by deeplink). |
| `weight` | Legacy intra-category tiebreak. Prefer host-owned `category` ordering. |

The factory shape keeps biome code free of any host-shell primitive (router,
auth client, toast) — which is what lets the same package load into today's
Next.js host and a different host tomorrow. Biomes reach the host **only**
through the kernel contract types and the `HostBridge`.

---

## How the host discovers and loads a web biome

1. **Build-time discovery.** `build/generate-biome-loaders.mjs` globs
   `biomes/<tier>/<id>/xema-biome.json`, filters to `xema.target === 'web'`, and
   emits a static loader map at `src/lib/biomes/generated/web-biome-loaders.ts`.
   Adding a biome directory is sufficient — no host edits.
2. **Runtime bootstrap.** `bootstrapBiomes()`
   (`src/lib/biomes/bootstrap.ts`) fetches `GET /platform/biomes/web` for the
   enabled set, dynamically `import()`s each enabled biome, and registers it via
   `registerFrontendBiome(factory, bridge)` from `@xemahq/ui-kernel`. A biome
   enabled in the catalog but missing from this build's loader map is surfaced as
   `unavailable_in_build` and skipped — never a hard failure. (A second,
   `REMOTE_FEDERATED` path can load a biome over Module Federation at runtime;
   both feed the same register path.)
3. **Registration.** The singleton `biomeRegistry` holds every registered biome;
   host surfaces subscribe to its revision counter so they re-render the moment a
   biome lands after first paint.

---

## Routes and route access

The host mounts two App-Router catch-all resolver segments that forward the
captured slug to `BiomeRouteResolver`:

- Org scope — `src/app/(authed)/[...biomeSlug]/page.tsx`
- Project scope — `src/app/(authed)/spaces/projects/[projectId]/[...biomeSlug]/page.tsx`

`BiomeRouteResolver` (`src/lib/biomes/biome-host-next/`) walks the registry for
contributions whose `projectScoped` matches the segment's scope and matches the
remainder against each `RouteContribution.path` via `matchRoute` — a tiny,
deterministic segment-by-segment matcher where `:name` segments bind params. The
first match wins; its `element()` renders inside a params provider so the page
reads its `:param`s (and, for project scope, `projectId`) through
`bridge.navigation.useRouteParams()` — never a router primitive. No match once
bootstrap has settled → the Next `notFound()` boundary.

`RouteAccess` is a closed set enforced declaratively at the resolver (least →
most privileged): `member` < `org-admin` < `platform-admin`. Nav-hiding is
**not** a security boundary — a deeplink reaches the resolver directly, so an
insufficient subject gets a clean "access denied" surface. Backend capability
checks remain the ultimate authority.

---

## Nav categories — you declare WHAT, the host owns WHERE

A page's `category` is the semantic menu group the biome declares its **intent**
to live in. The closed set is:

```
primary | build | operate | knowledge | admin | account
```

The host owns the menu information-architecture: `src/lib/nav-registry.ts`
defines the `NavCategory` taxonomy and maps each category to a concrete rail
group, heading, and order (`NAV_GROUPS`). Authors declare what a surface **is**,
not where it renders — so the platform can re-organise the global menu without
editing every biome. When a page omits `category`, the host falls back to its own
id-keyed taxonomy, then to the legacy `section`. An unresolvable category is
dropped and logged (fail-loud), never silently mis-placed.

> The per-biome `section` / `weight` fields are **deprecated** — they predate
> host-owned categories and remain only for un-migrated biomes. New biomes
> declare `category`.

---

## Slots and panels

Beyond full pages, a biome injects fragments into named host insertion points by
contributing `panels[]`. The host renders them with `<BiomeSlot name="…">`,
sorted by `weight`; when no biome contributes, the slot renders its fallback (or
nothing). Slot names are a typed catalog exported as `HostExtensionSlots` from
`@xemahq/ui-kernel/registry`; a duplicate slot registration fails fast.

Shipped slot names (`src/lib/shared/ui-kernel/registry/lib/extension-points.ts`):

| `HostExtensionSlots` key | Slot name | Where it renders |
|---|---|---|
| `OrgHeaderActions` | `org-header-actions` | Org shell header action cluster |
| `ProjectOverviewCards` | `project-overview-cards` | Project home overview grid |
| `ProjectOverviewSecondary` | `project-overview-secondary` | Secondary project-home column |
| `BiomesOverviewCards` | `biomes-overview-cards` | Biomes admin overview |
| `DashboardEmptyState` | `dashboard-empty-state` | Dashboard empty-state CTA row |
| `RunDetailActions` | `run-detail-actions` | Run detail action cluster |
| `RunDetailSidePanel` | `run-detail-side-panel` | Run detail right panel |
| `SessionActions` | `session-actions` | Agent-session action cluster |
| `SessionSidePanel` | `session-side-panel` | Agent-session side panel |
| `SessionRightHeader` | `session-right-header` | Left of the session's built-in header controls |
| `SettingsTabs` | `settings-tabs` | Settings tab strip |

A panel is `{ slot, id, render: () => ReactNode, weight? }`:

```tsx
import { HostExtensionSlots } from '@xemahq/ui-kernel/registry';

panels: [
  {
    slot: HostExtensionSlots.ProjectOverviewSecondary,
    id: 'acme-support/overview-card',
    render: () => <SupportOverviewCard />,
    weight: 500,
  },
],
```

### Page header actions

A page drives the host topbar — title, description, help-actions, back
affordance, and a right-aligned action cluster — through
`bridge.pageMeta.usePageMeta(...)`, **not** a slot. The host pushes the meta on
mount and pops it on unmount:

```tsx
function SupportDashboard(): JSX.Element {
  const bridge = useHostBridge();
  bridge.pageMeta.usePageMeta({
    title: 'Support',
    description: 'Triage inbound customer issues.',
    actions: ['Filter by severity', 'Assign to a teammate'],
    topbarActions: <NewTicketButton />,
  });
  return /* … */;
}
```

---

## The HostBridge

Every biome reaches host services through ONE host-agnostic object — the
`HostBridge` the factory receives, also available inside components via
`useHostBridge()` (`@xemahq/ui-kernel`). Biome UI consumes the platform through
the bridge plus generated Orval clients — never ad-hoc `fetch`, direct router
manipulation, or its own auth client.

| Bridge member | What it provides |
|---|---|
| `navigation` | `push` / `replace`, and the router-agnostic hooks `useLocation`, `useRouteParams`, `useSearchParams`. |
| `auth` | `getActorToken` / `getOrgId` / `getProjectId` / `getUserId`, plus host-owned token freshness (`ensureFreshToken`) and `onUnauthorized` 401 recovery — wire an Orval client's `getAuthToken` against these. |
| `queryClient` | The shared `@tanstack/react-query` `QueryClient`. |
| `toast` | `success` / `error` / `info`, each with an optional detail line. |
| `pageMeta` | `usePageMeta(...)` — the topbar/page-chrome surface (see above). |
| `system` | The **SystemBus** (`@xemahq/ui-kernel`) — capability invocation, cross-biome intents, the command palette, `xema://` deeplinks, and windowing. Pure orchestration: it NEVER authorizes; the backend capability-router is the sole authority on auth / tenancy / policy / audit. |
| `capabilities` | Server-authoritative capability port (`GET /bff/me/capabilities`). Gate UI on the effective capability set via `<CapabilityProvider>` + `useCapability()` — not cosmetic role booleans. |
| `requestContext` | The current `correlationId` for request tracing. |
| `realtime` *(optional)* | CloudEvents-over-SSE source; reach it through the kernel `useCloudEvent` / `useRealtimeStatus` / `useEventScope` hooks. Absent hosts omit it and those hooks fail fast. |
| `errors` *(optional)* | Canonical user-facing error decoder; falls back to the kernel default `getUserFacingErrorMessage`. |

---

## Session-shell contributions and output renderers

A biome extends the agent-session shell declaratively via the `session`
contributions object (session profiles, slash commands, secondary-drawer tabs,
header chips, mutation bars, activity/tool-call renderers, attachment classes)
and can bind a biome-defined artifact `OutputKind` to a renderer via
`outputRenderers[]` (overlaid on the built-in set; built-in kinds cannot be
overridden, new kinds light up when the biome loads). The reference biome
`template-third-party-web` (shipped with `xema-host-web`) exercises every
contribution kind — fork it to bootstrap a real biome.

---

## Embedded / external-subject routes

For a session rendered inside an external website (the
[App + Audience layer](../apps.md)), the host serves the embed routes
`(embedded)/embedded/session/[token]` and `(embedded)/embedded/shell` **outside**
the authenticated app shell — no Xema identity assumed, host chrome (rail,
topbar, branding) stripped. The host hook `useExternalSubject()` detects the
`/embedded/*` prefix and exposes the delegated session's verified claims
(`capabilities`, `environment`, `canCall(ref)`), so an embedded surface
constrains itself to exactly the caller's capability set. Treat
`isEmbedded && claims === undefined` as "verifying" and hold sensitive controls
until claims resolve.

See [Apps — embedding an app](../apps.md#embedding-an-app).

---

## Related pages

- [Manifest reference](./manifest.md) — the `xema-biome.json` fields, including `target` and `scope`
- [Apps](../apps.md) — how external-subject embedding works
- [Shell](../shell.md) — the terminal shell and its WS protocol
- [Capabilities](../capabilities.md) — how the SystemBus + `useCapability()` gating is enforced

---

**Previous**: [← Publishing](./publishing.md)
**Next**: [Events I subscribe →](./events-i-subscribe.md)
