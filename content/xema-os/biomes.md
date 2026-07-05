# Biomes

A **biome** is the Xema OS unit of distribution. Where a traditional extension model extends one surface, a biome may ship agents, skills, tools, workflows, deliverable specs, document templates and themes, mount sources, artifact types, connector bindings, frontend slot contributions, optional backend services, controllers, and storage schemas — all through one declarative manifest and one lifecycle.

A biome is *installed* into an organization, *zoned* into one or more execution zones, *versioned* under the user-controlled lifecycle, and *governed* by the two-stage permission model, backed by a fully-specified state machine.

---

## The biome lifecycle

A biome moves through deliberate, observable stages. The kernel never auto-promotes; humans hold the promotion gates.

```
draft  →  sandbox-installed  →  review-required  →  org-installed
                                                    →  store-submitted
                                                       →  store-approved
                                                          →  archived
```

| Stage | Environment | What it can do |
|---|---|---|
| `draft` | none (sources only) | lives in Biome Studio / Agent Studio; not callable, not installable |
| `sandbox-installed` | `sandbox` | runs in a sandbox environment with no org secrets; reads mounted inputs only |
| `review-required` | `sandbox` + `store-review` | inspected by a human reviewer; tests run; SBOM generated; permission diff shown |
| `org-installed` | `org` / `project` | callable by org subjects; capability grants resolved per environment |
| `store-submitted` | `store-review` | available to other orgs for inspection only; runs in a review environment with no real data |
| `store-approved` | global | installable by any org from the [Xema Store](./store.md) |
| `archived` | none | retained for lineage; not installable; existing locked installs keep working |

The enum is closed (`BiomeLifecycle` in `@xemahq/biome-host-api-client`). The state machine is one-directional in the happy path; reverse moves (`org-installed → archived`, `store-approved → archived`) are explicit capability calls, not implicit transitions.

---

## Lifecycle transitions are capability calls

Every transition is mediated by one capability and audited as one decision:

| From → To | Capability | Default approval policy |
|---|---|---|
| `draft → sandbox-installed` | `biome:install@1` | implicit (author's own draft) |
| `sandbox-installed → review-required` | `biome:promote@1` | `requiresApproval=true` |
| `review-required → org-installed` | `biome:promote@1` | `requiresApproval=true` |
| `review-required → store-submitted` | `biome:submit-to-store@1` | `requiresApproval=true` |
| `store-submitted → store-approved` | `biome:approve-in-store@1` (a.k.a. `store:biome.approve@1`) | reviewer approval required |
| `store-approved → archived` | `biome:archive@1` (a.k.a. `store:biome.archive@1`) | `requiresApproval=true` |
| `org-installed → archived` | `biome:archive@1` | `requiresApproval=true` |

All seven transitions emit a structured audit-log entry through `audit-log-api`. The `requiresApproval=true` default for every promote-out-of-sandbox capability is what enforces the "user holds command" rule across the lifecycle — no automated agent can promote a biome past the sandbox without an approval gate.

---

## Install — Stage 1 (consent)

The install capability `biome:install@1` is paired with `store:biome.install@1` for store-fetched biomes. The flow:

1. Caller invokes `biome:install@1` (or `store:biome.install@1`) with `{ biomeRef, version, environment, scope }`.
2. `biome-host-api` parses the manifest, computes a **permission digest** — capabilities grouped by domain, a risk tier, a data-access summary, and a diff against the previously installed version.
3. The digest is presented to an org admin; the admin chooses a built-in profile (`read-only-assistant`, `support-chatbot`, `internal-agent`, `connector-bridge`, `unrestricted`) or customizes per-capability resource scopes, zones, and rate limits.
4. Approval writes a `BiomeInstallGrant` row in `authorization-api`. The grant is the authoritative answer to "what may this biome do, in which environment?".

Until the admin approves, the biome stays in `sandbox-installed`. No runtime call ever consults a manifest field — every check goes through the grant.

---

## Install — Stage 2 (runtime brokering)

Every capability invocation by the installed biome routes through `xema-capability-router`:

1. Caller hands the gateway `{ ref, subject, environment, input }`.
2. Gateway looks up the `BiomeInstallGrant`.
3. Gateway checks: capability in the grant set, resource glob matches, environment allowed, subject covered, audience policy compatible, within rate / quota, no human approval required.
4. Allowed → the resolver dispatches to the bound contribution or kernel handler.
5. Denied → typed denial with an `auditId`. Run `xema why-denied <auditId>` (see [Shell](./shell.md)) for the structured reason and a suggested fix.

The biome never holds raw credentials. The gateway resolves the binding for the active environment and calls the connector itself; the biome sees the capability ref and the input only.

---

## What lives in a biome

The on-disk layout (rooted under `biomes/<id>/`):

```
xema-biome.json                ← manifest
contracts/
  capabilities.json            ← exposesCapabilities + requiresCapabilities
  permissions.json             ← role-capability + execution-environment hooks
backend/
  migrations/                  ← if the biome owns a relational database schema
  api/                         ← optional backend service(s)
  openapi.json                 ← when the biome ships a service
frontend/
  routes/                      ← RouteContributions
  slots/                       ← HostExtensionSlots entries
  widgets/                     ← widget-kind contributions
agents/                        ← Contribution(agent-definition)
skills/                        ← Contribution(agent-skill) folder bundles
workflows/                     ← Contribution(workflow-definition)
deliverable-specs/             ← Contribution(deliverable-spec)
document-templates/            ← Contribution(document-template)
document-themes/               ← Contribution(document-theme)
artifact-types/                ← Contribution(artifact-type)
mount-sources/                 ← Contribution(mount-source)
connectors/                    ← Contribution(connector-binding)
controllers/                   ← K8s-style reconcilers
runtime/
  docker-compose.fragment.yaml ← optional, dev-only
  helm/                        ← optional, when the biome ships a service
```

Every line under `agents/` through `controllers/` is one `ContributionKind` in the closed enum. See the [Manifest reference](./sdk/manifest.md) for how each path is declared and the [Backend SDK page](./sdk/backend-i-ship.md) for the `ships.apis[]` shape.

---

## The `contributions/` directory

The unified surface for everything a biome ships is the **`contributions/`** directory at the biome root. One `*.contribution.json` per contribution, each declaring its kind, its target object, and a pointer to the asset (folder, module, or inline manifest):

```
contributions/
  agent.greeter.contribution.json
  workflow.escalation.contribution.json
  skill.documentation.contribution.json
  connector.github.contribution.json
  mount-source.cve-feed.contribution.json
```

This replaces the legacy per-kind top-level directories (`agents/`, `workflows/`, `skills/`, …) and the legacy `xema.content.*` / `xema.modules.*` manifest blocks. Both old shapes lift cleanly into `contributions/` — the migration is mechanical, the data is the same, and every former content kind and module kind is now one value in the closed `ContributionKind` enum.

A new kind ("e.g. `chart-runtime` for Vega") is two files: one enum entry plus the Zod schema for its manifest. No new top-level directory, no new seeder, no scattered registry updates. See [SDK / Contributions](./sdk/contributions.md) for the authoring details.

---

## Multi-API biomes

A biome may ship **zero, one, or many** backend services through `ships.apis[]`. Each API gets its own Helm sub-chart, its own Docker image, its own subdomain, and its own capability namespace (`biome:<biomeId>.<apiName>.<verb>@1`). Cross-biome API imports are rejected by boundary CI — biome APIs talk to each other only through capabilities.

See [SDK / Backend I ship](./sdk/backend-i-ship.md) for the `ships.apis[]` field shape and base-path conventions.

---

## Storage

A biome that needs persistence either ships its own relational database schema (under `backend/api/migrations/`) or declares collections in `xema-biome.json`'s `storage` block and lets `biome-storage-api` host them. The shared data plane enforces per-tenant isolation (`org` / `project` / `sandbox`), a closed filter-grammar, field encryption, and an explicit `uninstallPolicy` (`retain` | `drop-on-uninstall`).

See [SDK / Storage](./sdk/storage.md).

---

## Packaging

Biomes are installed from `biomes/<id>/` source folders through the fetcher. The manifest (`xema-biome.json`) carries the `contributes[]` / `requiresCapabilities[]` / `exposesCapabilities[]` / `lifecycle` / `ships` / `storage` blocks.

Biomes are packaged and distributed as **OCI artifacts** through the same registry that holds Docker images. Signing (`cosign`), provenance (`SLSA`), and SBOM attachment ride the standard OCI flows. See [SDK / Publishing](./sdk/publishing.md).

---

## Related concepts

- [biome](./concepts/biome.md) — concept summary
- [lifecycle](./concepts/lifecycle.md) — the `BiomeLifecycle` state machine
- [manifest](./concepts/manifest.md) — the `xema-biome.json` contract
- [capability](./concepts/capability.md) — the call surface every transition uses
- [execution-environment](./concepts/execution-environment.md) — the zones biomes run in
- [store](./store.md) — the publish/install pipeline
- [versioning](./versioning.md) — draft vs published vs lockfile
- [apps](./apps.md) — composing biomes into product surfaces

---

**Previous**: [← Capabilities](./capabilities.md)
**Next**: [Shell →](./shell.md)
