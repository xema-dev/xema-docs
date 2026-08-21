# Apps

> API Docs: https://app-platform-api.xema.dev/api/docs

An **App** is the product-layer surface in Xema OS. It composes one or more biomes, adds optional product-specific UI and branding, and exposes itself to an [audience](./concepts/audience.md) — internal Xema users, external (non-Xema) subjects, or anonymous visitors. The same biome can live inside many apps; each app picks its own audience, environment, and capability policy.

The owning platform service is **`app-platform-api`**. It owns App definitions, App clients, audience policies, external subjects, and delegated-session minting.

---

## The App model

An App is `XemaObjectKind.App`:

```ts
interface App {
  ref: XemaObjectRef;                         // xema://orgs/acme/projects/support/apps/customer-portal
  installedBiomes: BiomeInstall[];            // { biomeRef, versionConstraint, configuration }
  defaultZone: ExecutionEnvironmentRef;       // must be admitted by the audience policy
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
sub          = external-subject:<externalId>   (or an anonymous subject)
act          = the app client that acted on the subject's behalf
org          = <orgId>
project      = <projectId>
session      = <sessionId>
environment  = <environmentRef>
capabilities = [<allowed capability refs>]
exp, jti, tokenClass
```

The capability set on the token is the intersection of the app's capability policy, the audience policy, and the subject's grants.

### Signing — a rotating key ring, and no symmetric option

Delegated sessions are signed by a **key ring**, not by a single configured key.

- The ring holds many keys. Exactly one is active (`activeKid`); the others are retired but still published for a rotation overlap of 24 hours, so a token minted just before a rotation still verifies afterwards.
- Each key is identified by its RFC 7638 JWKS thumbprint, and its private half is stored encrypted at rest.
- Rotation is a compare-and-set on the ring's version, so two replicas rotating at once cannot fork the ring.

**HS256 is not merely discouraged — it is unrepresentable.** The `SigningAlgorithm` enum has exactly two members, `RS256` and `ES256`; new rings are created on `ES256`; verification is pinned to those two; and the algorithm column carries a database CHECK constraint admitting only those two values. A symmetric key in that column would mean every service that can *verify* a delegated session can also *mint* one, so the structure refuses it rather than a comment discouraging it.

Public keys are served at:

```
GET /public/.well-known/delegated-session-jwks.json
```

so downstream services verify without round-tripping. There is deliberately no RFC 8414 discovery document — these tokens are not an OIDC provider surface.

### Public ingress doors

Public ingress lives on its own hostname so the platform auth guard can be bypassed in a controlled way. Every door is enumerated here, and **every door takes a client credential** except the one where the credential is the request itself:

| Endpoint | Client credential |
|---|---|
| `POST /public/apps/:appSlug/sessions` | `clientId` + `clientSecret` |
| `POST /public/apps/:appSlug/auth/oidc` | `clientId` + `clientSecret` |
| `POST /public/apps/:appSlug/auth/magic-link/request` | `clientId` + `clientSecret` |
| `POST /public/apps/:appSlug/auth/magic-link/verify` | none — the single-use 32-byte link token *is* the credential |
| `POST /public/apps/:appSlug/auth/anon` | `clientId` + `clientSecret` |
| `GET /public/sessions/:id` | none — keyed by the session id the caller already holds |
| `POST /public/sessions/:id/revoke` | none — self sign-out by the session-id holder |

`clientId` alone is a row primary key, not a secret. Requiring the paired secret is what makes the anonymous door a *credentialled* anonymous door: the end user is anonymous, the embedding application is not.

Every door then routes through **one shared admission path**, which:

1. authenticates the client credential;
2. requires the app's `AudiencePolicy` to exist — no policy is a `403 AUDIENCE_POLICY_NOT_FOUND`, never a permissive default;
3. resolves the execution environment and refuses it with `403 ZONE_NOT_ALLOWED_FOR_AUDIENCE` unless it is listed in the policy's `allowedEnvironments`. The app's `defaultZone` supplies the default, it does not override the policy;
4. applies the rate limits below.

### Verifying a delegated token

Internal services that accept on-behalf-of calls verify via `POST /delegated-sessions/verify`. The response is a flat claim set — `appId`, `sub`, `act`, `org`, `project`, `session`, `environment`, `capabilities[]`, `exp`, `jti`, `tokenClass`. There is no nested identity object.

| Endpoint | Purpose |
|---|---|
| `POST /delegated-sessions/verify` | Verify a JWT |
| `GET /delegated-sessions/:id` | Read session metadata |
| `POST /delegated-sessions/:id/revoke` | Revoke |

---

## Rate limiting

`AudiencePolicy` carries **two** ceilings, and every public door is capped by both where both apply:

| Field | Default | Bucket |
|---|---|---|
| `rateLimitPerHourPerSubject` | 600 | `subject:<clientId>:<subjectExternalId>` |
| `rateLimitPerHourPerClient` | 6000 | `client:<clientId>` |

Both are NOT NULL with a positive-value database CHECK. **There is no value meaning "unlimited"** — a nullable ceiling reads as unconfigured while possibly enforcing nothing, which is the shape this platform has already paid for elsewhere.

The per-client cap applies **unconditionally, on every door**. The per-subject cap applies only once a subject exists.

That asymmetry is the point, and it is why the anonymous door is capped per client only: an anonymous call mints a *fresh* external subject per request, so there is no subject to key a bucket on. Keying one anyway — the earlier `anon:<clientId>` bucket — produced a single shared bucket for every anonymous user in the world, wearing a per-subject name.

The limiter is Redis-backed and atomic. Exceeding a bucket is `429 RATE_LIMIT_EXCEEDED`; an unavailable limiter is `503 RATE_LIMITER_UNAVAILABLE` — it fails closed rather than admitting uncapped traffic.

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
