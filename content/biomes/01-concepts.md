# Biome Concepts

A **biome** is a folder bundle with a `xema-biome.json` manifest at its root. Unlike a library or a microservice, a biome describes *what it contributes* declaratively; the platform decides *how* and *where* those contributions run based on the execution environment, the active grants, and the org's installed profile.

---

## The manifest

`xema-biome.json` is the sole required file. A minimal manifest:

```json
{
  "name": "acme-code-review",
  "version": "1.0.0",
  "displayName": "Acme Code Review",
  "description": "Automated PR review workflows for the Acme engineering team.",
  "lifecycle": "draft",
  "requiresCapabilities": [
    "connector:scm.create-pull-request@1",
    "kb:page.write@1"
  ],
  "permissionHints": {
    "connector:scm.create-pull-request@1": "Posts review comments back to the PR.",
    "kb:page.write@1": "Stores review summaries in the knowledge base."
  },
  "defaultProfile": "internal-agent",
  "contributions": {
    "workflows": ["workflows/pr-review.yaml"],
    "agents": ["agents/reviewer.agent.json"],
    "skills": ["skills/code-review/"]
  }
}
```

Key fields:

| Field | Purpose |
|---|---|
| `name` | Unique kebab-case identifier within the org |
| `version` | Semantic version; the Store and lockfile pin to this |
| `lifecycle` | Current state in the lifecycle state machine |
| `requiresCapabilities` | Every capability ref the biome may invoke |
| `permissionHints` | Human-readable reason per capability (shown at install time) |
| `defaultProfile` | Built-in profile that best fits this biome's risk level |
| `contributions` | Paths to each contribution kind |

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

| Kind | Folder | Description |
|---|---|---|
| `agent-definition` | `agents/` | Named agents with prompts and intrinsic skills/tools |
| `agent-skill` | `skills/` | Skill folder bundles (see [Skills](../xema-os/skills/)) |
| `workflow-definition` | `workflows/` | Workflow YAML files |
| `deliverable-spec` | `specs/` | Structured output contracts |
| `connector-binding` | `contracts/` | Named connector bindings (SCM, tracker, docs, chat) |
| `document-template` | `templates/` | Document and report templates |
| `mount-source` | `backend/mount-sources/` | Custom agent workspace mount sources |
| `artifact-type` | `backend/artifact-types/` | Custom artifact kinds |
| `event-subscription` | `contracts/events.json` | Declarative CloudEvent subscriptions |
| `backend-service` | `backend/api/` | Optional backend service with capabilities namespace |
| `frontend-route` | `frontend/routes/` | New UI routes in the platform shell |
| `frontend-slot` | `frontend/slots/` | Platform UI slot contributions |
| `storage-schema` | `backend/migrations/` | Managed relational database schema for the biome |

---

**Previous**: ← (this is the first page in the section)

**Next**: [Authoring →](./02-authoring.md)
