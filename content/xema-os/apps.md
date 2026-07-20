# Apps

> API Docs: https://app-platform-api.xema.dev/api/docs

An **App** is the product-layer surface in Xema OS. It composes one or more biomes, adds optional product-specific UI and branding, and exposes itself to an [audience](./concepts/audience.md) — internal Xema users, external (non-Xema) subjects, or anonymous visitors. The same biome can live inside many apps; each app picks its own audience, environment, and capability policy.

The owning platform service is **`app-platform-api`**. It owns App definitions, App clients, audience policies, external subjects, and delegated-session minting.

---

## The App model

An App is `XemaObjectKind.App`:

```ts
interface App {
  ref: XemaObjectRef;                         // xema://org/acme/project/support/app/customer-portal
  installedBiomes: BiomeInstall[];            // { biomeRef, versionConstraint, configuration }
  defaultZone: ExecutionZoneRef;              // typically a project-scoped environment
  audiences: AudiencePolicy[];                // who may use the app, through which auth path
  capabilityPolicy: CapabilityPolicyOverride[];
  branding: BrandingConfig;
  lockfile: AppLockfile;                      // see Versioning
}
```

Apps are addressable in [XVFS](./concepts/xvfs.md) at `/orgs/<org>/projects/<project>/apps/<appId>`. They share the universal [object lifecycle](./concepts/lifecycle.md) — drafts iterate freely; only `published` apps accept external traffic.

### Admin endpoints (Xema-identity callers)

| Endpoint | Purpose |
|---|---|
| `POST /apps` | Create an app |
| `GET /apps` / `GET /apps/:id` | List / read |
| `PATCH /apps/:id` | Update branding, biomes, capability policy |
| `POST /apps/:id/archive` | Lifecycle transition to archived |
| `POST /apps/:id/lockfile/refresh` | Resolve and persist a full pinned [lockfile](./versioning.md) |

App admin endpoints terminate at the org-internal ingress (`app-platform-api.xema.dev`).

---

## App clients

An **App client** is a credential pair (client_id + client_secret) that the embedding website uses to mint delegated sessions. Each app may have multiple clients (one per environment, one per embedding domain).

| Endpoint | Purpose |
|---|---|
| `POST /apps/:appId/clients` | Create a client (returns the secret once) |
| `GET /apps/:appId/clients` | List clients |
| `GET /clients/:id` | Read |
| `POST /clients/:id/revoke` | Revoke |

Client secrets are stored hashed with `scrypt`. The plaintext secret is returned only at create time.

---

## Audience policies

An `AudiencePolicy` declares who may use the app and through which auth path. Three kinds, closed enum:

| Audience kind | Auth path | Typical use |
|---|---|---|
| `internal-org` | Xema identity | Internal portal — every user is a Xema user with project membership |
| `external-subject` | App-supplied (OIDC upstream, magic link, anon login) → delegated session | Customer-facing chatbot; non-Xema users |
| `public-anon` | None | Anonymous read-only experiences (marketing FAQ, public KB browse) |

External subjects do **not** become Xema users. They are app-scoped identities. The audience policy holds the auth configuration; the delegated session carries the resolved subject.

| Endpoint | Purpose |
|---|---|
| `POST /apps/:appId/audience-policies` | Attach a policy to an app |
| `GET /apps/:appId/audience-policies` | List policies |
| `PATCH /audience-policies/:id` / `DELETE /audience-policies/:id` | Update / detach |

---

## Delegated session JWT

When an external subject signs in through an app, `app-platform-api` mints a short-lived **delegated session JWT**. The token carries:

```
sub          = external-user:<externalId>     (or anon:<random>)
act          = app:<appClientId>
org          = <orgId>
project      = <projectId>
session      = <sessionId>
environment         = <environmentId>                       (typically environment:public-session)
capabilities = [<allowed capability refs>]
exp          = short
```

Signing is **RS256** in production (with an HS256 dev fallback). Public keys are exposed at the standard JWKS endpoint so downstream services verify without round-tripping. The capability set on the token is the intersection of the app's `capabilityPolicy`, the audience policy, and the subject's grants.

### Public ingress endpoints (no Xema identity required)

These live on a separate ingress hostname (`app-platform-public.xema.dev`) so platform AuthGuard can be bypassed in a controlled way — every public endpoint is decorated with `@Public()` and listed in the AuthGuard `extraExcludes`.

| Endpoint | Purpose |
|---|---|
| `POST /public/apps/:appSlug/sessions` | Start a session for an external subject (the app's auth path authenticates first; this endpoint mints the delegated JWT) |
| `GET /public/sessions/:id` | Read session state (delegated-token-authenticated) |
| `POST /public/sessions/:id/revoke` | Revoke the session |

The split between the internal and public ingress hostnames is enforced by ingress annotations + the AuthGuard `extraExcludes` on `/public/*`. They terminate at the same Service.

### Verifying a delegated token

Internal services that accept on-behalf-of calls verify via `POST /delegated-sessions/verify`. The service returns the decoded claims plus a structured `SubjectIdentity` the gateway can authorize against. Other endpoints:

| Endpoint | Purpose |
|---|---|
| `POST /delegated-sessions/verify` | Verify a JWT |
| `GET /delegated-sessions/:id` | Read session metadata |
| `POST /delegated-sessions/:id/revoke` | Revoke |

A separate platform-internal mint endpoint exists for invite flows; it is gated by service tokens, never reachable from public traffic, and not part of the documented public surface.

---

## Rate limiting

`app-platform-api` ships a Redis-backed rate limiter (atomic Lua `INCR + EXPIRE`). Limits apply per app + audience + endpoint. The limiter is the first line of defence on the public ingress; the second line is the standard capability-gateway rate-and-quota check on every capability invocation routed through the delegated session.

---

## Embedding an app

External sites embed an app by:

1. Calling the app's auth endpoint to authenticate the external subject (or skipping for `public-anon`).
2. Posting to `POST /public/apps/:appSlug/sessions` with the App client credentials and the external subject id; the response is a delegated session JWT.
3. Loading the embedded UI in an iframe pointed at `/embedded/session/:token`.

The embedded route lives outside the host shell's `ProtectedAppShell` — it does not assume a Xema identity, and the host chrome (sidebar, navigation, branding) is replaced by the app's own. The hook `useExternalSubject()` detects the `/embedded/*` URL prefix and constrains the rendered surface to the delegated session's capability set.

### Minimal embed snippet

```html
<!-- The app's own server mints a delegated session token on behalf of the external user -->
<iframe
  src="https://app-platform-public.xema.dev/embedded/session/eyJhbGciOiJSUzI1NiIs...?app=customer-portal"
  width="480"
  height="640"
  allow="clipboard-read; clipboard-write"
  referrerpolicy="strict-origin"
></iframe>
```

The iframe-safe route, the public ingress hostname, and the delegated JWT together form one trust boundary — the embedding site never sees a Xema identity, and Xema never sees the embedding site's user store.

---

## Related concepts

- [app](./concepts/app.md) — concept summary
- [audience](./concepts/audience.md) — the policy that gates who may use an app
- [delegated-session](./concepts/delegated-session.md) — the JWT shape
- [capability](./concepts/capability.md) — the gateway every app call routes through
- [biomes](./biomes.md) — what apps install and compose
- [versioning](./versioning.md) — apps own lockfiles too

---

**Previous**: [← Versioning](./versioning.md)
**Next**: [SDK / Getting Started →](./sdk/getting-started.md)
