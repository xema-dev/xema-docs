# Authoring a Biome

A biome is a folder with a **`xema-biome.json`** manifest at its root. Everything else — agents, skills, workflows, contribution envelopes, an optional API service — is discovered from conventional directories or declared in the manifest. This page walks through the authoring lifecycle from first file to local validation; the field-by-field schema detail lives in the generated [Manifest Reference](./04-manifest-reference.md).

---

## Scaffold a starting point

The fastest way to a valid biome is to generate one:

```bash
xema biome scaffold acme-code-review --target server --scope platform
```

The scaffolder re-parses the generated `xema-biome.json` with the real platform manifest parser before it returns, so a fresh scaffold is guaranteed installable. Pass `--target web` for a frontend-only biome.

---

## Folder layout

A biome ships content by **on-disk presence**: drop files into the conventional directory and the platform discovers them — there is no per-kind declaration list in the manifest. A typical server biome:

```
acme-code-review/
  xema-biome.json                 ← manifest (required, the only strict file)
  agents/
    reviewer.md                   ← agent definition; also listed in xema.agents[]
  skills/
    code-review/                  ← skill folder bundle (SKILL.md required)
      SKILL.md
      reference/
        style-guide.md
  workflow-config/
    pr-review.yaml                ← workflow YAML
  deliverable-specs/
    review-report.yaml            ← deliverable spec
  workspace-manifests/
    reviewer.workspace.yaml       ← agent workspace manifest
  contributions/
    scm-binding.contribution.json ← typed contribution envelopes
  install-schema/                 ← install-wizard schema (required with
                                    integrationRequirements)
  provisioning/                   ← provisioning scaffolds; also listed in
                                    xema.provisioning[]
  api/
    acme-code-review-api/         ← optional API service, declared in
                                    xema.ships.apis[]
```

Every directory is optional — a biome that only ships skills is just `xema-biome.json` + `skills/`. The full directory-to-content-kind table is in the [Manifest Reference](./04-manifest-reference.md#convention-content-directories).

---

## `xema-biome.json` — the manifest

The manifest is a wrapped `{ "name", "version", "xema": { … } }` document. `name` is a scoped package name, `version` is the semver the Store and lockfiles pin to, and everything biome-specific lives under `xema`, discriminated on `xema.target` (`server` or `web`).

A realistic server-biome manifest:

```json
{
  "name": "@acme/code-review",
  "version": "1.2.0",
  "xema": {
    "id": "acme-code-review",
    "displayName": "Acme Code Review",
    "description": "PR review workflows and AI reviewer agents for engineering teams.",
    "scope": "platform",
    "target": "server",
    "requiresCapabilities": ["kb:page.write@1", "artifact:read@1"],
    "exposesCapabilities": [],
    "permissions": {
      "defaultProfile": "internal-agent",
      "hints": [
        {
          "capability": "kb:page.write@1",
          "reason": "Stores the review report in the knowledge base.",
          "riskTier": "medium"
        },
        {
          "capability": "artifact:read@1",
          "reason": "Reads the PR diff artifact produced by the trigger workflow.",
          "riskTier": "low"
        }
      ]
    },
    "agents": [{ "slug": "reviewer", "mode": "primary" }],
    "contributions": { "directory": "./contributions" },
    "ships": {
      "apis": [
        {
          "name": "acme-code-review-api",
          "path": "./api/acme-code-review-api",
          "displayName": "Acme Code Review API",
          "serviceKind": "biome-api",
          "exposesCapabilities": []
        }
      ]
    }
  }
}
```

### Key fields explained

**`xema.id`** — the kebab-case biome identifier. It must match the biome's folder name and is the namespace for everything the biome contributes.

**`xema.scope`** — the dependency/boot tier: `kernel`, `system`, `base`, or `platform`. Third-party biomes are `platform`; the lower tiers are reserved for the platform's own foundation.

**`xema.target`** — `server` or `web`. A server biome ships backend contributions the platform boots and supervises; a web biome is a static frontend bundle the host shell loads. A product usually pairs one of each (see below).

**`xema.requiresCapabilities`** — every capability ref (`domain:slug@version`) the biome may invoke at runtime. Declaring a capability here does not grant it; the org admin approves the grant at install time. If a capability is not declared here, the gateway denies every call for it, regardless of any grant.

**`xema.permissions`** — install-time consent metadata: a `defaultProfile` recommendation plus one `hints[]` entry per required capability explaining *why* the biome needs it and its `riskTier`. Shown verbatim to the approving org admin.

**`xema.agents[]`** — the explicit roster of agents the biome ships, one entry per `agents/<slug>.md` file. The platform validates roster ⟷ file parity at boot, so an agent file added or removed without a manifest update fails fast instead of drifting.

**`xema.ships.apis[]`** — the API services the biome ships, one entry per service under `api/<name>/`. Content contributions (agents, skills, workflows, …) are **not** declared here — they are discovered from their convention directories.

**`xema.contributions`** — points at the directory of typed `*.contribution.json` envelopes (default `./contributions`), or carries entries inline.

The complete field list — including `runtimeRequirements`, `integrationRequirements`, `webhookFilters`, MCP tool declarations, and the install/upgrade lifecycle hooks — is in the [Manifest Reference](./04-manifest-reference.md).

### Web biome manifests

A web biome's manifest is smaller — it names the server biome(s) it needs and the host shell does the rest:

```json
{
  "name": "@acme/code-review-web",
  "version": "1.2.0",
  "xema": {
    "id": "acme-code-review-web",
    "displayName": "Acme Code Review",
    "scope": "platform",
    "target": "web",
    "requiresServerBiomes": ["acme-code-review"]
  }
}
```

The bundle default-exports a frontend module built with `defineWebBiome` — see [UI: I contribute](../xema-os/sdk/ui-i-contribute.md).

---

## Writing agent contributions

An agent definition is a markdown file in `agents/`, one `<slug>.md` per agent. YAML frontmatter carries the agent's identity and permissions; the body is the system prompt:

```markdown
---
name: reviewer
displayName: PR Reviewer
description: Reviews pull requests using the code-review skill and writes structured feedback.
mode: primary
---

# PR Reviewer

You are an expert code reviewer...
```

Every agent file must also appear in `xema.agents[]` with its execution `mode` (`primary` for a session's lead agent, `subagent` for a delegate other agents can task). The manifest roster and the on-disk files are cross-validated at boot — keep them in sync.

---

## Writing skill contributions

Skills contributed by a biome live under `skills/` as folder bundles. Each bundle must have a `SKILL.md` file with `name` and `description` frontmatter:

```markdown
---
name: code-review
description: Teaches the agent to review diffs, apply style guides, and write structured review comments.
---

# Code Review Skill

...reference material, style guides, checklists...
```

`SKILL.md` is the only strict file — `reference/`, `scripts/`, and `assets/` are free-form and mounted as-is. Sub-skills are nested folders, each with its own `SKILL.md`:

```
skills/
  code-review/
    SKILL.md                         ← required
    reference/
      style-guide.md
    security-review/
      SKILL.md                       ← each sub-skill also requires SKILL.md
```

The platform mounts the full bundle into the agent workspace and registers a `/code-review` slash command automatically.

---

## Typed contribution envelopes

Single-file, typed contributions (capabilities, connector bindings, document templates, …) ship as one `*.contribution.json` per entry under `contributions/`:

```json
{
  "kind": "capability",
  "id": "review-report-fetch",
  "manifest": { }
}
```

The `manifest` body is validated by the owning platform service per `kind`; a malformed envelope fails the biome's activation fast. See [Contribution envelopes](./04-manifest-reference.md#contribution-envelopes) for the closed set of kinds and the inline form.

---

## Local validation

Validation is layered, and every layer uses the same platform schema — never a docs-only approximation:

- **Scaffold time** — `xema biome scaffold` re-parses the generated manifest with the real platform parser before it returns.
- **Author time** — `xema biome validate` runs the full pre-boot checks over the biome directory — manifest schema, `xema.agents[]` ⟷ `agents/*.md` parity, contribution envelopes, skill frontmatter, workflow schemas — without booting anything. It works from anywhere inside the biome and exits non-zero when a check fails, so it drops straight into CI.
- **Lint** — `xema biome lint` runs the workspace boundary checks (biome folder layout, deprecated-name usage, hardcoded tool names) from anywhere inside a Xema workspace.
- **Boot time** — when the platform loads the biome, the manifest is parsed against the schema and the `xema.agents[]` roster is cross-validated against the on-disk `agents/*.md` files. A drifted manifest fails fast instead of silently degrading.

Fix any errors before publishing.

---

## Running it locally

During development, a biome that lives in your workspace boots directly — no publish, no token:

```bash
xema dev
```

From inside a single biome directory, `xema biome dev` runs the validation pass above and then boots only the smallest platform slice that biome needs — the sandbox loop for developing one biome without a full workspace.

Workspace sources always take precedence over remote sources for the same biome id, so local edits win. To try a biome published elsewhere without a running platform, fetch it to your machine:

```bash
xema biome install acme-code-review --local --from my-registry
```

When the biome is ready to share, [publish it](./03-store.md) as a signed OCI artifact with `xema biome publish`.

---

**Previous**: [← Concepts](./01-concepts.md)

**Next**: [Store →](./03-store.md)
