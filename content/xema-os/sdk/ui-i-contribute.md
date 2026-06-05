# SDK — UI I Contribute

A biome contributes to the host frontend through three declarative surfaces:

- **HostExtensionSlots** — named insertion points in the host shell;
- **RouteContributions** — top-level routes the biome adds to the host's router;
- **Nav registry entries** — sidebar / topbar items the host renders.

All three are declared in `xema-biome.json` and resolved at host boot. The host shell is the React app under `submodules/code-guilds-web`; the kernel contract lives in `@xemahq/ui-kernel/registry`.

---

## HostExtensionSlots

The host exposes a closed catalog of named slots — well-known places in the UI where biomes may inject content. The catalog is defined in `packages/ui/biome-registry-web/src/lib/extension-points.ts`.

Examples of shipped slot names:

| Slot | Where it renders |
|---|---|
| `SessionRightHeader` | Top-right of a session detail page |
| `ProjectOverviewSidebar` | Below the project KPIs on the project home |
| `StudioRightDock` | The Studio's right-hand inspector |
| `AppRailExtra` | Below the standard app-rail items |

The slot enum is closed; extending it is a kernel PR. A biome registers a contribution to a slot by manifest:

```jsonc
{
  "xema": {
    "frontend": {
      "slots": [
        {
          "slot": "SessionRightHeader",
          "module": "./dist/frontend/session-header.js",
          "export": "MyHeaderWidget",
          "permissions": ["kb:page.read@1"]
        }
      ]
    }
  }
}
```

The host loads `module`, picks the named `export`, and mounts it inside `<BiomeSlot slot="SessionRightHeader" />`. The slot component is a React component; the host passes a typed `SlotContext` prop derived from the current route, the active project, and the session id.

Permissions on the slot are evaluated at render time: if the current subject does not hold every listed capability for the current environment, the slot does not render. Slots never carry credentials.

---

## RouteContributions

A biome may add top-level routes to the host router. Each entry binds a path to a lazy-loaded module export:

```jsonc
{
  "xema": {
    "frontend": {
      "routes": [
        {
          "path": "/biomes/acme-support/dashboard",
          "module": "./dist/frontend/dashboard.js",
          "export": "DashboardPage",
          "label": "Support Dashboard",
          "icon": "headphones",
          "requiresCapabilities": ["biome:acme.support.dashboard.read@1"]
        }
      ]
    }
  }
}
```

Rules:

- `path` MUST begin with `/biomes/<biomeId>/` or the biome's own dedicated subtree (e.g. an [app-runtime](../apps.md)-fronted public route). Top-level paths reserved for the platform (`/projects`, `/orgs`, `/store`, `/shell`, `/embedded`) are rejected.
- `module` is a module path inside the biome's `frontend/` build output.
- `requiresCapabilities[]` is evaluated by `useCapabilityCall()`; if any ref is missing in the current grant set + environment, the host renders the route's "permission denied" surface (with a structured `auditId`).
- `label` and `icon` feed the navigation registry — see below.

The host's router resolves contributions at boot. There is no runtime registration API; the manifest is the only source of truth.

---

## Nav registry entries

The host nav (app-rail + section-level navs) is built from the union of:

1. platform-owned nav entries (hard-coded);
2. RouteContributions whose `label` is non-empty;
3. explicit nav entries declared in `xema-biome.json`'s `frontend.nav[]` for routes that need a nav presence without a label on the route itself.

Each entry carries:

| Field | Purpose |
|---|---|
| `id` | Stable slug for the nav entry |
| `label` | Display text |
| `icon` | Icon key (lucide name) |
| `path` | Target path |
| `section` | One of `org`, `project`, `os`, `studio`, `store`, `apps` |
| `position` | Optional integer for ordering inside the section |
| `requiresCapabilities[]` | Hidden when the subject lacks any listed ref |

The host uses the same precedence rules for nav as for routes: platform-owned entries always come first; biome-contributed entries are sorted by `position` (default `100`).

---

## Hooks the host provides to biome UI

The host exposes a stable hook surface at `submodules/code-guilds-web/src/lib/os/`:

| Hook | Purpose |
|---|---|
| `useExecutionZone()` | Current environment + setter (persisted per user) |
| `useObjectRegistry()` | Unified search across KB, artifacts, memory, skills, biomes, agents, workflows |
| `useCapabilityCall()` | Uniform invocation hook through `xema-capability-router` with optimistic UI + audit-log linkage |
| `useXemaShellSession()` | WebSocket lifecycle + structured command dispatch + xterm.js wiring for the Shell |
| `useExternalSubject()` | Detect `/embedded/*` context; constrain UI to the delegated session's capability set |
| `useAudiencePolicy()` | Current session / object audience scope + `canShareTo(audience)` predicate |

Biome UI MUST consume the platform through these hooks and the generated Orval clients — no `fetch` to platform endpoints, no direct router manipulation, no environment overrides outside `useExecutionZone()`. The boundary lint enforces this.

---

## Iframe-embedded routes

For routes that render inside an external website (the [App + Audience layer](../apps.md)), the host serves `/embedded/session/:token` and `/embedded/shell` outside the `ProtectedAppShell`. Biome route contributions that need to support embedded mode should:

- Avoid the host's standard navigation chrome — `useExternalSubject()` returns `true` and the host strips the rail / topbar.
- Constrain interactions to the delegated session's capability set (the hook exposes the set).
- Use `referrerpolicy="strict-origin"` on any outgoing links.

See [Apps — embedding](../apps.md#embedding-an-app).

---

## Related pages

- [Manifest reference](./manifest.md) — the `frontend` block field-by-field
- [Apps](../apps.md) — how external-subject embedding works
- [Shell](../shell.md) — `useXemaShellSession()` and the WS protocol
- [Capabilities](../capabilities.md) — how `requiresCapabilities[]` is enforced at render time

---

**Previous**: [← Publishing](./publishing.md)
**Next**: [Events I subscribe →](./events-i-subscribe.md)
