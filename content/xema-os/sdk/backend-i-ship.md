# SDK — Backend I Ship

A biome may ship **zero, one, or many** backend services. The manifest's `ships.apis[]` field is the declaration; the host (`biome-host-api`) materialises each entry as its own Helm sub-chart, its own image, its own subdomain, and its own capability namespace.

This page documents the `ships.apis[]` shape, the base-path conventions, and the cross-biome import rules. For lifecycle hook modules (which run in-process, not as a service), see [Lifecycle Hooks](./lifecycle-hooks.md).

---

## When to ship an API

A biome ships its own API when it needs:

- a long-running process (sweepers, schedulers, queue consumers);
- a custom HTTP surface with controllers Xema cannot infer from the manifest;
- a relational database schema with non-trivial migrations and joins;
- WebSocket, SSE, or other transports beyond simple capability invocation.

A biome should **not** ship an API when its needs fit:

- a few collections of structured rows — use [biome-storage-api collections](./storage.md);
- one-shot install / uninstall housekeeping — use [lifecycle hooks](./lifecycle-hooks.md).

Consuming platform events, by contrast, **does** require a shipped service — the event consumers register inside it. See [Events I consume](./events-i-subscribe.md).

---

## `ships.apis[]` shape

```jsonc
{
  "xema": {
    "ships": {
      "apis": [
        {
          "name": "ingestor",
          "basePath": "/ingest",
          "image": { "package": "./api/ingestor", "port": 3000 },
          "scopes": ["ingest.read", "ingest.write"]
        },
        {
          "name": "renderer",
          "basePath": "/render",
          "image": { "package": "./api/renderer", "port": 3000 },
          "scopes": ["render.execute"]
        }
      ]
    }
  }
}
```

| Field | Required | Purpose |
|---|---|---|
| `name` | yes | Stable identifier; appears in the API's capability namespace and in the subdomain |
| `basePath` | yes | URL prefix Xema's ingress routes to this API (must start with `/`) |
| `image.package` | yes | Source folder relative to the biome root |
| `image.port` | yes | Container port the service listens on |
| `scopes` | optional | Free-form scope strings for `@Scopes()` runtime checks inside the service |

Each API is exposed under `<biomeId>.<name>.api.<base-domain>`. The manifest does not declare the full hostname — the host computes it from the biome id, the API name, and the cluster's base domain.

---

## Capability namespace per API

Every API gets its own capability namespace:

```
biome:<biomeId>.<apiName>.<verb>@<major>
```

For example, a biome `acme.support` with two APIs (`ingestor` and `renderer`) would expose refs like:

```
biome:acme.support.ingestor.write@1
biome:acme.support.ingestor.read@1
biome:acme.support.renderer.execute@1
```

Refs are declared in `xema-biome.json`'s `exposesCapabilities[]` and resolved by `xema-capability-router` to the corresponding API. Callers — other biomes, agents, workflows, the Shell — never address the API's HTTP surface directly; they invoke the capability and the gateway routes the call.

This is the only way cross-biome calls happen. The boundary check enforces it:

- A biome's API source MUST NOT import another biome's API source.
- A biome's API source MAY import `@xemahq/*` published kernel packages.
- A biome's API source MAY import generated platform clients from `@xemahq/<service>-api-client`.

Direct HTTP from biome A's code to biome B's API bypasses the gateway, bypasses authorization, and bypasses audit — boundary CI rejects it.

---

## Multiple APIs in one biome

Multiple APIs make sense when one biome's workload splits naturally — a write-heavy ingestor next to a read-heavy renderer, or a public-facing facade next to a private worker. Each API:

- has its own Dockerfile (or shares the canonical backend service Dockerfile with `SERVICE=<api-name>` build arg);
- has its own Helm sub-chart with its own env vars, secrets, and resource limits;
- has its own OpenAPI document at `<api-package>/openapi.json`;
- generates its own Orval client into the biome's own package layout.

The split is at the namespace level — the two APIs may share a managed database (one row per API in the biome's `helm/` values), share a Redis instance, or share neither.

---

## Base-path conventions

Xema reserves the following base-path prefixes for platform-owned surfaces. Biome APIs must avoid them:

| Prefix | Owner |
|---|---|
| `/api/*` | Backend service default — fine inside the biome's own service |
| `/health/*` | Standard liveness / readiness — required on every biome API |
| `/system/*` | Reserved for kernel APIs |
| `/store/*` | Reserved for `xema-store-api` |
| `/shell/*`, `/sandbox/*` | Reserved for `xema-shell-api` |

Use a biome-specific prefix (`/incidents`, `/renderer`, `/connector-link`) and let the ingress prepend the biome subdomain.

---

## Health and readiness

Every biome API MUST expose three endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /health` | Top-level liveness probe |
| `GET /health/live` | Kubernetes liveness |
| `GET /health/ready` | Kubernetes readiness (must check the DB / Redis it depends on) |

The host's Helm sub-chart wires these to liveness and readiness probes. A biome API that does not expose them fails the install boundary check.

---

## Shipping migrations

Biome APIs that own database tables ship migrations under `api/migrations/`. The platform runs them as part of the Helm `migrationJob` before the API itself starts accepting traffic. Migrations are write-once and never edited after they ship — the same rules that govern platform-owned schemas apply.

---

## Related pages

- [Manifest reference](./manifest.md) — the `ships` block
- [Capabilities](../capabilities.md) — how the gateway routes calls to a biome API
- [Storage](./storage.md) — the shared data plane alternative to shipping your own DB
- [Lifecycle Hooks](./lifecycle-hooks.md) — for one-shot install / upgrade work that does not warrant a service

---

**Previous**: [← Lifecycle Hooks](./lifecycle-hooks.md)
**Next**: [Storage →](./storage.md)
