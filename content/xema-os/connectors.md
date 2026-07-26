# Connectors

> API Docs: https://connector-gateway-api.xema.dev/api/docs

A **Connector** is a typed integration point with an external system — GitHub, GitLab, Gitea, Jira, Confluence, Slack, S3, an email provider, an LLM provider, anything an org needs to reach. Connectors are how Xema OS calls outward without giving agents (or workflows) raw credentials. The connector is the *type*; a **ConnectorBinding** is the per-org installation of that type with concrete credentials, scopes, and a target resource.

All inbound webhooks from external systems enter through one gateway. All outbound calls go through the same gateway with policy-mediated credential mint. There is no "just use the SDK directly" escape hatch — every external interaction is a capability call.

---

## Two objects, one model

Connectors and bindings are first-class typed objects in [Objects](./objects.md):

| Object kind | What it represents | Owner |
|---|---|---|
| `Connector` | The integration *type* — GitHub, Slack, Jira, … | Contributed by a [biome](./biomes.md) |
| `ConnectorBinding` | One concrete installation — credentials + target | Owned by an [Org or Project Space](./spaces.md) |

A biome contributes a connector by shipping a `connector` contribution in its manifest. An org admin (or, for project-scoped resources, a project admin) creates a binding by completing the install flow for that connector — picking the credential kind, supplying the secret, and selecting the target resource.

Bindings are addressable through the [Space URI grammar](./spaces.md):

```
xema://orgs/acme/connector-binding/github-main
xema://orgs/acme/projects/billing/connector-binding/jira-prod
```

A workflow or agent that needs to call out names the binding URI — never the provider, never the token.

---

## Why connectors and not "the agent calls the SDK"

Three reasons, all enforced at the gateway:

1. **Credentials never leave the gateway.** The minted token is bound to one invocation, one capability, and a short TTL. Even a fully compromised agent process cannot leak a usable secret.
2. **Every external call is auditable as a capability invocation.** The audit row records the binding ref, the capability ref, the subject, and the policy decision — not a free-form HTTP log.
3. **Provider swap is a binding change, not a code change.** A workflow that opens a pull request names `connector:scm.create-pull-request@1`. The same YAML works against GitHub, GitLab, or Gitea if the org's binding for that step points there.

---

## Capabilities a connector exposes

A connector ships one or more [capability refs](./capabilities.md) under the `connector:` domain. The 1B pilot capability set is the canonical example:

```
connector:scm.create-pull-request@1
connector:scm.merge@1
connector:tracker.issue.create@1
connector:docs.publish-page@1
connector:chat.send-message@1
connector:llm.invoke@1
```

Each ref maps to a typed input schema, a typed output schema, and an explicit [Execution Environment](./environments.md) requirement. The connector's biome manifest declares which capabilities the connector exposes; the install flow surfaces them in the [Permission Digest](./capabilities.md#worked-example--connector-pilot) the admin approves.

---

## Wallet credentials — the closed `CredentialKind` set

The gateway supports a fixed set of credential kinds. Each kind is a strategy: a pure projection from the encrypted at-rest payload to a freshly minted token the runner can use.

| `CredentialKind` | What it carries | When to use |
|---|---|---|
| `OAuthUser` | Three-legged OAuth user-delegated access + refresh token | Acting on behalf of a real human (GitHub user app, Atlassian OAuth) |
| `OAuthClient` | Two-legged `client_credentials` grant token | Server-to-server with the connector's own client identity |
| `Pat` | Personal access token, no expiry | CI-style integrations against GitHub/GitLab/Gitea |
| `ApiKey` | Long-lived API key, no expiry | Slack bot tokens, Linear keys, third-party SaaS keys |
| `BotToken` | Provider-issued bot token | Workspace-scoped Slack/Discord bots |
| `Basic` | `username` + `password` | Legacy SCM hosts, internal endpoints |
| `RestrictedKey` | Scoped API key (provider-side scopes encoded) | Stripe restricted keys, Twilio scoped tokens |
| `AppInstall` | GitHub-App-style installation token | First-party app installations across many repos |
| `IamRole` | Cloud IAM role assumption parameters | AWS/GCP/Azure access using STS or workload identity |
| `SignatureOnly` | Webhook secret only — no minted credential | Inbound-only providers (verify, no outbound) |
| `ImapAuth` / `SmtpAuth` | Email wallet | Email-provider connectors |

Credential rotation is **not** performed on the mint hot path. Strategies are pure projections; rotation runs out-of-band on a schedule. A token whose `expiresAt` is past is refused with a typed denial — there is no silent fallback to a stale token.

---

## OAuth installation flow

For `OAuthUser` and `OAuthClient` bindings, the install flow is uniform across providers:

1. The admin opens the connector's install page (a biome-contributed UI surface).
2. The gateway issues a one-time state token and redirects to the provider's authorize endpoint with the connector-declared scopes.
3. The provider redirects back to the gateway callback. The gateway verifies the state, exchanges the code for tokens, and writes an encrypted credential payload under the new binding.
4. The binding moves to `ready`. The biome's `onInstall` lifecycle hook fires and may perform an initial sync.

The redirect URL is always a gateway endpoint — never a biome endpoint. Biome code is never on the OAuth code-exchange path. Provider client secrets live in the gateway's KMS-backed secret store; biome manifests reference them by name, not value.

---

## Inbound webhooks — one ingress edge

Every inbound webhook from an external provider enters the gateway through a single ingress edge. The gateway:

1. Verifies the provider signature using the binding's `SignatureOnly` payload (or the bound credential's signing key).
2. Looks up the binding from the provider's `(provider, deliveryId, accountId)` tuple.
3. Translates the raw payload into a canonical `IntegrationWebhookEnvelope<TPayload>` typed per `WebhookEntityKind`.
4. Forwards the envelope to the owning domain service with a deterministic `Idempotency-Key = {provider}:{deliveryId}`.

Domain services receive canonical envelopes only — they never parse provider-specific payloads, never touch raw signatures, never see the binding's secret. Adding a new provider is a gateway-side change; downstream consumers are untouched as long as the canonical envelope is unchanged.

---

## Binding lifecycle

`ConnectorBindingState` is a closed enum:

| State | Meaning | Next states |
|---|---|---|
| `pending` | Binding row created; OAuth or wallet step not complete | `ready`, `failed` |
| `ready` | Credentials present and validated; mint serves tokens | `degraded`, `revoked` |
| `degraded` | Last mint or webhook failed signature/auth; gateway probes on a schedule | `ready`, `revoked` |
| `revoked` | Admin or provider revoked the binding; mint refuses, audit retained | terminal |

A revoked binding is **never** silently restored. The admin re-runs the install flow to produce a new binding row.

---

## Related concepts

- [Capabilities](./capabilities.md) — connectors expose capability refs; the connector pilot section shows the end-to-end flow.
- [Spaces](./spaces.md) — bindings live in an Org or Project Space and inherit its data-classification floor.
- [Policy](./policy.md) — every connector capability call passes through a policy decision and may carry `BindResidency` / `BindRegion` obligations.
- [Execution Environments](./environments.md) — connector capabilities declare the environment they run under (e.g. `project` for project-scoped SCM).
- [Biomes](./biomes.md) — connectors are contributed by biomes through the `connector` contribution kind.

---

**Previous**: [← Capabilities](./capabilities.md)
**Next**: [Biomes →](./biomes.md)
