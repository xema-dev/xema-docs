# Biome Concepts

A **biome** is a folder bundle with a `xema-biome.json` manifest at its root. Unlike a library or a microservice, a biome describes *what it contributes* declaratively; the platform decides *how* and *where* those contributions run based on the execution environment, the active grants, and the org's installed profile.

---

## The manifest

`xema-biome.json` is the sole required file. It is a wrapped `{ "name", "version", "xema": { … } }` document — everything biome-specific lives under `xema`, discriminated on `xema.target` (`server` or `web`). A minimal manifest:

```json
{
  "name": "@acme/code-review",
  "version": "1.0.0",
  "xema": {
    "id": "acme-code-review",
    "displayName": "Acme Code Review",
    "description": "Automated PR review workflows for the Acme engineering team.",
    "scope": "platform",
    "target": "server",
    "requiresCapabilities": ["kb:page.write@1"]
  }
}
```

Key fields:

| Field | Purpose |
|---|---|
| `name` | Scoped package name; the Store and lockfile pin `name@version` |
| `version` | Semantic version |
| `xema.id` | Unique kebab-case biome identifier (matches the folder name) |
| `xema.target` | `server` (backend contributions) or `web` (frontend bundle) |
| `xema.scope` | Dependency/boot tier: `kernel`, `system`, `base`, `platform` |
| `xema.requiresCapabilities` | Every capability ref the biome may invoke |
| `xema.permissions` | Consent metadata (profile recommendation + per-capability reasons) shown at install time |
| `xema.ships.apis[]` | API services the biome ships (content is discovered from convention directories instead) |

The full field-by-field detail — generated from the platform schema itself — is in the [Manifest Reference](./04-manifest-reference.md).

---

## The lifecycle state machine

A biome progresses through deliberate, observable stages. Xema never auto-promotes — humans hold every promotion gate.

```
draft  →  sandbox-installed  →  review-required  →  org-installed
                                                    ↓              ↓
                                              store-submitted   archived
                                                    ↓
                                              store-approved
                                                    ↓
                                                archived
```

| State | Environment | What the biome can do |
|---|---|---|
| `draft` | none | Exists in Biome Studio; not callable, not installable |
| `sandbox-installed` | `sandbox` | Runs with no org secrets; reads mounted inputs only |
| `review-required` | `sandbox` + `store-review` | Under human review; tests run; SBOM generated; permission diff shown |
| `org-installed` | `org` / `project` | Callable by org subjects; capability grants resolved per environment |
| `store-submitted` | `store-review` | Available to other orgs for inspection; no real data |
| `store-approved` | global | Installable by any org from the Xema Store |
| `archived` | none | Retained for lineage; not installable; existing locked installs continue working |

The state machine is one-directional in the happy path. Moving to `archived` is always explicit and requires the `biome:archive@1` capability. No automated agent can promote a biome past the sandbox without an org-admin approval gate.

---

## Capability declarations

The biome manifest is a *declaration*, not a permission. Every runtime invocation must pass through the **capability gateway**, which consults the `BiomeInstallGrant` created when the org admin approved the install. If a capability is not in the grant, the call is denied and an `auditId` is returned.

### Stage 1 — install time

1. The biome is submitted for install.
2. The platform computes a **permission digest**: capabilities grouped by domain, a risk tier, a data-access summary, and a diff against the previously installed version.
3. An org admin reviews the digest, optionally choosing a built-in profile or customizing per-capability resource scopes, zones, and rate limits.
4. Approval creates a `BiomeInstallGrant` row. This grant is the single authoritative answer to "what may this biome do, in which environment?".

### Stage 2 — runtime

Every call from the biome goes through the capability gateway with `{ ref, subject, environment, input }`. The gateway checks the grant, verifies the resource glob, the environment, the rate limit, and any required approval. Allowed calls proceed; denied calls return a typed denial with an `auditId` you can inspect with `xema why-denied <auditId>`.

---

## Contribution kinds

A biome can contribute:

| Kind | Where it lives | Description |
|---|---|---|
| Agent definitions | `agents/<slug>.md` + `xema.agents[]` | Named agents with prompts and permissions; the manifest roster and the files are cross-validated |
| Skills | `skills/` | Skill folder bundles (see [Skills](../xema-os/skills/)) |
| Workflows | `workflow-config/` | Workflow YAML files |
| Deliverable specs | `deliverable-specs/` | Structured output contracts |
| Workspace manifests | `workspace-manifests/` | Agent workspace manifests |
| Typed contribution envelopes | `contributions/*.contribution.json` | Capabilities, connector bindings, document templates, and every other single-file typed kind |
| Event subscriptions | `xema.subscribes[]` | Declarative CloudEvent subscriptions bound to handler modules |
| API services | `api/<name>/` + `xema.ships.apis[]` | Optional backend services the biome ships |
| Managed database | `xema.database` | Managed relational schema provisioned per org, migrated at boot |
| Frontend (web) | `<id>-web/` package | UI pages, nav items, and slot panels — a `target: "web"` biome that default-exports a frontend module (authored via `defineWebBiome`). See [UI: I contribute](../xema-os/sdk/ui-i-contribute.md) |

Multi-file content kinds are discovered by **on-disk presence** of their convention directory — there is no per-kind declaration list in the manifest. The complete directory table is in the [Manifest Reference](./04-manifest-reference.md#convention-content-directories).

---

**Previous**: ← (this is the first page in the section)

**Next**: [Authoring →](./02-authoring.md)
