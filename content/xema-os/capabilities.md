# Capabilities

A **capability** is a typed invocation surface. Every meaningful action in Xema OS — read a knowledge-base page, create a pull request, start a workflow run, install a biome, send a Slack message — is named by a capability reference, mediated by one gateway, and authorized against one grant table. Agents, workflows, UI buttons, the Shell, and external apps all use the same surface.

---

## Capability refs

A capability reference is a stable, versioned name:

```
<domain>:<resource>.<verb>@<major>
```

The pilot set:

```
kb:page.read@1
kb:page.write@1
artifact:read@1
workflow:run.start@1
workflow:control@1
workspace:session.create@1
workspace:session.invite@1
document:render.pdf@1
memory:recall@1
memory:store@1
biome:install@1
biome:promote@1
biome:submit-to-store@1
store:biome.list@1
connector:scm.create-pull-request@1
connector:scm.merge@1
connector:tracker.issue.create@1
connector:docs.publish-page@1
connector:chat.send-message@1
connector:llm.invoke@1
mcp-tool:invoke@1
```

The `@<major>` is intentional. Capability refs version like syscalls, not like packages: minor and patch changes to an implementation never break the ref. A major bump is a deliberate, additive event — v1 stays alive until callers migrate. This is the only thing in Xema that auto-versions; everything else respects the user-controlled versioning policy.

---

## The gateway flow

Every invocation goes through one funnel. **`xema-capability-router` lands in Phase 3** — until then, capability refs are declared in manifests and resolved statically; the runtime invocation surface is not yet live.

When it lands, the flow is:

```
caller
  → xema-capability-router
    → authorization-api      (subject + environment + capability + resource → decision)
    → resolver               (environment + binding state → which contribution serves this ref?)
    → implementation         (the bound contribution or kernel handler)
    → audit-log              (every invocation, structurally)
```

Every call carries `{ ref, subject, environment, input }`. Every decision lands in `audit-log-api`. Agents never hold raw credentials — the gateway resolves the binding for the active environment and calls the provider itself. The agent sees the capability ref and the input; nothing else.

---

## The two-stage permission model

Xema OS pairs install-time consent (App Store / Google Play) with runtime brokered access (Flatpak / XDG portals). Both stages are mandatory in production environments.

### Stage 1 — install time

The biome manifest declares:

- `requiresCapabilities[]` — every ref the biome may ask for.
- `permissionHints[]` — a human-readable reason per capability.
- `defaultProfile` — the built-in permission profile that fits.

The Xema Store computes a `PermissionDigest`: capabilities grouped by domain, a risk tier, a data-access summary, and a diff against the previously installed version. An org admin approves the digest, optionally applying a built-in profile (e.g. `read-only-assistant`, `support-chatbot`, `internal-agent`, `connector-bridge`, `unrestricted`) or customizing per-capability resource globs, environments, and rate limits. The result is a `BiomeInstallGrant` row in `authorization-api`.

### Stage 2 — runtime

Every capability call is authorized against the grant before it reaches the implementation. The gateway checks:

1. Is the capability in the biome's `BiomeInstallGrant`?
2. Is the resource inside the grant's allowed resource glob?
3. Is the environment in the grant's allowed environment set?
4. Is the subject covered (direct identity, group, or role)?
5. Is the audience policy compatible?
6. Within rate and quota?
7. Does the grant require human approval for this call?

Allowed → invocation proceeds. Denied → fail-fast with a structured response. Either way, audited.

**Phase rollout note.** Built-in profiles and the `BiomeInstallGrant` table land in Phase 3 alongside `authorization-api`. The nine built-in execution environments become enforced in Phase 4 — until Phase 4 the `environment` field exists on grant rows but is a forward-compatibility placeholder.

---

## Structured denials

Denial is a typed response, not a stack trace. Every denial carries an `auditId` the caller can pass to the Shell's `why-denied <auditId>` to get back:

```jsonc
{
  "auditId": "deny_123",
  "subject": { "kind": "agent", "ref": "agent:support-bot" },
  "capability": "workflow:run.start@1",
  "environment": "public-session",
  "decision": "denied",
  "reasons": [
    {
      "code": "MISSING_GRANT",
      "detail": "workflow:run.start@1 is not granted in public-session"
    }
  ],
  "suggestions": [
    { "kind": "request-grant", "capability": "workflow:run.start@1", "environment": "app" },
    { "kind": "switch-environment", "from": "public-session", "to": "project" }
  ]
}
```

Agents can self-correct (switch environment, ask a human to grant the capability) without trial-and-error. Humans get the same data, formatted.

---

## Worked example — connector pilot

Phase 1B ships the connector domain end-to-end. A workflow that opens a pull request looks like this:

1. The workflow step declares `connector:scm.create-pull-request@1` as a required capability.
2. The biome manifest exposes (or requires) the same ref.
3. At runtime the workflow runner asks the gateway: "open a PR against repo `xema://orgs/acme/projects/main/connector-binding/github-main`, branch `feature/x`, title `…`, body `…`."
4. The gateway checks the `BiomeInstallGrant` for the workflow's subject, finds the connector binding allowed for the `project` environment, and calls the GitHub connector with the org's stored credentials.
5. The agent never sees the GitHub token. The response is a typed artifact ref pointing at the new pull request.

The same workflow YAML works against GitLab or Gitea if the org's connector binding for that resource points there — the workflow names no provider.

---

## Phase rollout

| Phase | Capability surface |
|---|---|
| 1A | Capability ref parser, `CapabilityGrant`, `CapabilityPolicy` types in `@xemahq/capability-contracts`. No runtime. |
| 1B | The full connector capability set above. One provider per domain wired end-to-end through capability refs. |
| 3 | `xema-capability-router` + `authorization-api` go live; every connector call routes through them. |
| 4 | Nine built-in execution environments seeded and enforced, including the `trusted-dev` escape hatch for biome authors. |
| 5 | Shell commands map 1:1 to capability invocations. |

---

## Service-to-service auth — Keycloak-issued tokens

Every cross-service call in the Xema OS layer (`xema-capability-router`,
`authorization-api`, `audit-log-api`, `biome-host-api`, `object-registry-api`,
`xema-shell-api`, `llm-registry-api`, etc.) authenticates with a
**Keycloak service-account access token**, not a static shared secret.

The model is uniform:

- At boot, each service registers itself with the **Xema Identity Service** via
  `IdentityBootstrapService` (`@xemahq/identity-client`). The identity service
  provisions a Keycloak OAuth2 client (one per service) and returns the
  `client_id` + `client_secret` + `token_endpoint`.
- On every outbound call, the service requests an access token via the
  Keycloak `client_credentials` grant. Tokens are cached in-process and
  refreshed at ~80% of declared lifetime (with jitter to desync replicas).
- The caller sends `Authorization: Bearer <token>`. The receiver's global
  `JwtVerificationGuard` (from `@xemahq/platform-common`) validates the
  signature against the realm JWKS, checks issuer and expiry, and rejects
  on any failure. There is no second, shared static-secret check.
- The only legacy `IDENTITY_API_INTERNAL_TOKEN` env var still in service
  configs is the **one-time bootstrap secret** the identity service uses to
  authenticate the initial registration request. Once the service holds
  Keycloak credentials it doesn't carry any other static internal token.

Fail-fast: if a service cannot mint a Keycloak token at the moment of a
non-best-effort outbound call (e.g. capability invocation), the call
errors out. There is no static-token fallback. Best-effort observability
paths (audit-log appends) log and continue.

This matches the per-allocation worker-token model used by the agent
runtime: same Keycloak realm, same JWKS, same guard — just a different
client per caller.

---

## The six meta-tools — how agents see capabilities

Agents never see individual MCP servers or per-biome tool surfaces. They see exactly six meta-tools — `search`, `describe`, `invoke`, `plan`, `preflight`, `explain` — and discover everything else dynamically:

| Meta-tool | What it does |
|---|---|
| `xema.capabilities.search` | Retrieves the capabilities the calling agent is **authorized to invoke** in the current Execution Context. All arguments are flat and optional: `{ query?, domain?, resourceType?, mutating?, limit?, cursor? }`. Each entry: `{ ref, biome, title, summary, riskTier, requiresApproval, mutation }`. |
| `xema.capabilities.describe` | Returns the full schema for one or more refs: `{ ref, inputSchema, outputSchema, examples, sideEffects, requiresApproval, biome: { id, version } }`. Accepts an array of up to 50 refs in one call. |
| `xema.capabilities.invoke` | Generic invocation: `{ ref, input }` → `{ output, auditId, obligations }`. `input` is validated against the capability's full declared JSON Schema at the gateway boundary before runner dispatch. |
| `xema.capabilities.plan` | Derives the shortest runnable sequence to a goal capability over the capability graph: `{ goalCapabilityRef, fromResourceTypes, maxDepth? }` → `{ goal, found, steps, missingResourceTypes }`. |
| `xema.capabilities.preflight` | Checks readiness before a call can fail: `{ ref }` → `{ ready, requirements, blockers }` — missing credentials, grants, or runtimes. |
| `xema.capabilities.explain` | Turns a denial code from a failed `invoke` into the exact grant that unlocks it: `{ capabilityRef, denialCode }` → `{ permissions, domain, biome, suggestions }`. |

**There is no full-catalogue listing.** `search` returns only what the caller may actually invoke — denied capabilities are absent, not flagged, and there is no "include denied" switch. Retrieval is graph-scoped: give it an anchor (`resourceType`, or a noun in `query` that names a known resource type) and it walks that type's capability-graph neighbourhood, which is the fast, high-precision path. Without an anchor it falls back to a bounded, paginated catalogue query — page through it with `cursor`, taken from the previous response's `nextCursor`.

Worked example — an agent discovers and calls a capability:

```jsonc
// 1. Discover (flat args — no filter wrapper)
xema.capabilities.search({ domain: "connector" })
// → {
//     "capabilities": [
//       { "ref": "connector:scm.create-pull-request@1", "biome": "xema.software-dev", ... },
//       { "ref": "connector:chat.send-message@1", "biome": "xema.slack-connector", ... }
//     ],
//     "anchor": { "resourceType": null, "source": "none" },
//     "consideredCount": 2
//   }

// 2. Describe (batched)
xema.capabilities.describe({ refs: ["connector:scm.create-pull-request@1"] })
// → [{ "ref": "...", "inputSchema": { ... }, "examples": [ ... ] }]

// 3. Invoke — input must match the declared schema exactly
xema.capabilities.invoke({
  ref: "connector:scm.create-pull-request@1",
  input: { repoRef: "xema://orgs/acme/.../github-main", branch: "feature/x", title: "..." }
})
// → { "output": { "url": "https://github.com/...", "number": 42 }, "auditId": "inv_abc" }
```

Adding a new biome or MCP server expands the `search` result without changing the agent's tool surface. Agents adopt new capabilities at runtime; no prompt rebuild required.

### Invocation input is strictly validated

`invoke` validates `input` against the capability's **full declared JSON Schema** — types, enums, and string formats are enforced, and unknown properties are rejected. Nothing is coerced: a string is not silently parsed into a number, and an extra or misspelt field is not dropped. A violation is a fail-fast `400` that names the offending JSON path, so an agent can correct the exact field rather than guess. Callers must send exactly the shape `describe` returns.

---

## External MCP servers as capability providers

Xema OS does not show an agent the union of every MCP server's `tools/list`. Instead, external MCP servers are registered through `mcp-gateway-api` as **capability providers**:

1. Admin registers an external server (e.g. an organisation's Slack MCP, a Jira MCP, a Notion MCP).
2. At registration time, `mcp-gateway-api` calls the external server's MCP `tools/list`.
3. Each external tool is translated to a capability ref: `<provider-id>:<tool-name>@1`.
4. The capability is inserted into the Service Registry with runner kind `mcp-external`.
5. `xema.capabilities.search` surfaces the provider's capabilities under the same policy + grant model as any first-party capability — and, like every other capability, only to subjects authorized to invoke them.
6. On `xema.capabilities.invoke`, the gateway translates the call back to an MCP `tools/call` against the registered server.

The agent's view stays uniform: every capability — first-party, biome-shipped, or externally federated — is a ref behind the same six meta-tools. Policy, audit, and grant flows are identical.

---

## Capability lifecycle

Each capability ref carries a lifecycle state that constrains how it may be invoked:

| State | Meaning |
|---|---|
| `proposed` | Declared in a manifest but never seeded; `search` omits it |
| `seeded` | Registered in the Service Registry; eligible for grants |
| `published` | Granted, invocable, and returned by `search` for authorised subjects |
| `deprecated` | Still invocable; `search` marks it; `describe` carries a `replacedBy` ref |
| `retired` | No longer invocable; the gateway returns a structured denial pointing at the successor |

Lifecycle is per-major-version. Bumping `@1 → @2` introduces a new ref; the `@1` ref enters `deprecated` and the manifest declares `replacedBy: "...@2"`.

---

## See also

- [MCP and Capabilities](./mcp-and-capabilities.md) — deeper detail on the three-meta-tool flow and external MCP server registration.
- [Execution Contexts](./execution-contexts.md) — the per-invocation envelope every capability call carries.
- [Policy](./policy.md) — the decision protocol every invocation is gated by.

---

**Previous**: [← Objects](./objects.md)
**Next**: [SDK / Getting Started →](./sdk/getting-started.md)
