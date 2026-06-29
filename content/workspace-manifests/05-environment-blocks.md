# Environment Blocks

A workspace manifest is the **single environment contract** an agent runs against. Beyond mounts and seed files, the manifest declares the agent's **runtime topology** — sub-agents, skills, MCP tool selection, credentials, tool permissions, persistence paths, preview surface, and the surfaces (interactive or workflow) the manifest is compatible with. Each block is a closed-set, schema-validated section of `spec` or `metadata`; the platform's resolver consumes them at every boot and at every resume.

---

## Why one contract

Before this contract, the same agent could boot under three different configuration shapes depending on the surface — workflow steps, interactive sessions, and biome-shipped profiles each carried their own knobs. The manifest now subsumes all of them. **Same manifest, same resolved environment, every surface.**

The benefits:

- One audit trail per environment shape (the manifest's `slug@version` pin).
- Resume always re-resolves from the manifest — never replays a frozen bundle. Drift between runs is surfaced as a structured event, not a silent rewrite.
- Biome authors ship a single artifact; the same manifest powers a session, a workflow step, or a developer's local fork.

---

## `metadata.surfaceCompat`

Declares which execution surfaces the manifest is allowed to boot on. Closed enum.

```yaml
metadata:
  slug: brainstorming-default
  version: 2.0.0
  surfaceCompat:
    - agent-session
```

Values:

| Surface | What it means |
|---|---|
| `workflow` | Manifest can be referenced from a workflow agent step. |
| `agent-session` | Manifest can boot an interactive session. |

A manifest may list either or both. At resolve time the platform compares the call site's surface against this list; a workflow step pointing at an `agent-session`-only manifest fails fast with a typed error.

When `metadata.surfaceCompat` is omitted, the platform defaults to `[workflow, agent-session]` for backwards compatibility with pre-existing manifests. Newly authored manifests should declare the field explicitly.

---

## `metadata.display`

UX framing — read by the Studio tile picker, the session-start picker, and the workflow canvas Inspector when it surfaces the manifest catalog. No runtime effect.

```yaml
metadata:
  display:
    title: Brainstorming
    blurb: Open canvas with delegate designers for rapid ideation.
    icon: sparkles
    category: ideation
    sortOrder: 1
    badges:
      - kernel
      - curated
    ctaText: When the idea is ready, launch a pipeline run for production implementation.
    hidden: false
    curated: true
```

`title`, `blurb`, `icon`, `category`, `badges` drive the visual tile. `sortOrder` orders manifests within a category. `hidden: true` excludes the manifest from picker results without deactivating it. `curated: true` marks kernel-shipped curated manifests so the UI can surface them above biome-shipped peers.

---

## `spec.agent.subAgents`

Manifest-declared sub-agent delegates. Each entry is a slug from the LLM registry's agent catalog with optional alias and default-model override.

```yaml
spec:
  agent:
    slug: brainstorm
    stage: interactive
    role: brainstorming
    subAgents:
      - slug: html-builder
      - slug: architecture-doc-writer
        defaultModel:
          kind: strategy
          modelClass: creative
```

The primary agent's intrinsic delegates (declared in its source frontmatter `permission.task`) form the floor — they cannot be removed by the manifest. Manifest-declared sub-agents are layered on top. A session or workflow step may further refine model overrides per-slug, but never remove a manifest-declared delegate.

---

## `spec.skills`

Skill bundles auto-mounted at session or workflow boot.

```yaml
spec:
  skills:
    - slug: preview-builder
      version: ^1
    - slug: requirements-elicitation
      version: ~1.2.3
```

`slug` references a skill in the LLM registry's skill catalog (kebab-case). `version` is an optional semver pin or range; omit to track the catalog's current version.

The platform resolves each skill at boot and writes `SKILL.md` under `/workspace/<slug>/` so the agent reads them as first-class instruction sections.

---

## `spec.toolSelection`

Default MCP tool selection inherited by every session/run booted on this
manifest. Each entry references either an entire provider (all its tools)
or one specific tool from a provider.

```yaml
spec:
  toolSelection:
    # All tools from an org-registered MCP server
    - kind: provider
      providerKind: mcp_server
      resourceId: 9b7f4d4e-9c8e-4e5a-9d2a-2a8b5e6f0c11
    # All tools from a curated catalog
    - kind: provider
      providerKind: catalog
      resourceId: default-dev-tools
    # A single tool from a biome workflow. resourceId is the biome
    # installation id — a plain string; parameterize with ${input.<name>}
    # if it varies per dispatch.
    - kind: tool
      providerKind: biome_workflow_tools
      resourceId: "imap-fetcher-installation-id"
      toolName: search-archive
    # A single tool shipped as biome handler code
    - kind: tool
      providerKind: biome_code_tools
      resourceId: "stripe-tools-installation-id"
      toolName: customer-lookup
```

Closed-set `providerKind` values:

| Value | Source of tools |
|---|---|
| `mcp_server` | An org-registered (or system-shipped) MCP server. |
| `catalog` | A named, reusable selection of tools curated at the org. |
| `biome_workflow_tools` | A biome manifest declaring `xema.mcpWorkflowTools[]`. |
| `biome_code_tools` | A biome shipping typed handler functions as tools. |

Sessions may override this list per-instance via `PATCH /sessions/:id/tools`.
At boot, every entry resolves through the platform's tool resolver into
the agent's `mcp` config — the manifest selection is the floor, the
session selection is the override.

---

## `spec.credentials`

Typed credential bindings the agent needs at runtime. Replaces the ad-hoc `${secrets.*}` escape hatch with a structured contract.

```yaml
spec:
  credentials:
    - name: GITHUB_TOKEN
      kind: scm-token
      sourceRef: project/scm/github/default
      required: true
    - name: STRIPE_KEY
      kind: oauth-bearer
      sourceRef: wallet/payments/stripe-test
  env:
    - name: GITHUB_TOKEN
      value: ${credential.GITHUB_TOKEN}
```

`name` is UPPER_SNAKE_CASE — the same name shows up in `env[].value` interpolation. `kind` is a closed enum (`llm-provider`, `scm-token`, `oauth-bearer`, `mcp-auth`, `wallet-entry`, `generic-secret`); the platform routes each kind to the correct fetcher (LLM gateway, SCM integration, secrets API, wallet store). `sourceRef` is opaque to the manifest — its shape depends on `kind`.

`required: true` makes resume fail fast if the credential cannot be resolved at boot; `required: false` (default) emits a warning drift and continues.

---

## `spec.permissions`

Tool authority overlay. Allowlist or denylist closed-set toolset keys on top of the agent's intrinsic floor.

```yaml
spec:
  permissions:
    tools:
      allow:
        - read
        - write
        - exec
        - web
        - mcp
        - delegate
      deny: []
```

Closed-set values: `read`, `write`, `exec`, `web`, `mcp`, `delegate`.

The manifest's allowlist NARROWS authority; it never expands beyond what the agent's frontmatter `permission.tools` already grants. A tool absent from the allowlist is denied at runtime even if the agent definition itself would have allowed it.

---

## `spec.persistence`

Workspace-relative paths captured on pause and restored on resume.

```yaml
spec:
  persistence:
    paths:
      - deliverables
      - .uploads
      - PIPELINE_INTENT.md
```

Each path is relative to `/workspace/`. The platform snapshots these paths into the session's storage when the worker is paused; on resume, the worker boots with the snapshot tree pre-populated before the first prompt.

Paths starting with `/` or containing `..` are rejected at compile time. Empty array means "snapshot the agent's chat history only" — the workspace tree gets recreated fresh from the mount plan on resume.

---

## `spec.outputSurface`

Declares a live-preview surface the workspace exposes. Consumed by the platform's preview engine to wire a route at boot.

```yaml
spec:
  outputSurface:
    kind: web
    port: 5173
    healthPath: /
    autoOpen: true
```

Closed-set `kind` values:

| Kind | What it means |
|---|---|
| `none` | No preview surface (default). |
| `web` | Long-running webserver listening on `port`. |
| `static` | Static-built artifact directory served by the platform's proxy. |
| `app` | Desktop-style embedded app surface. |
| `tunnel` | Arbitrary TCP port tunnelled through the proxy. |

`port` is required for every kind other than `none`. `healthPath` defaults to `/`. `autoOpen: true` triggers the preview pane the moment the worker reports the route ready.

---

## Resume drift

Every successful boot persists the resolved environment as a snapshot on the session row. On resume the platform re-resolves the manifest from scratch and diffs the new snapshot against the prior one. Differences surface as a structured **drift report**:

- **Warning drifts** (`subagent-added`, `skill-version-changed`, `tool-selection-added`, `tool-selection-removed`, `env-var-added`, …) emit a `SessionEnvironmentDriftDetected` event into the session timeline and resume proceeds.
- **Critical drifts** (`agent-changed`, required `credential-removed`, `credential-kind-changed`) fail the resume with a typed error; the operator sees the drift list quoted on the failure event.

The session row keeps the most-recently-resolved snapshot. The snapshot is a debug/audit aid, never the source of truth for replay — the live manifest is always authoritative.

---

## Migrating from session profiles

Interactive session profiles were a parallel configuration system that pinned a primary agent slug, a manifest reference, and a bag of default skills, MCP services, sub-agents, and model. Every field on a profile now has a 1:1 home on the manifest:

| Profile field | Manifest home |
|---|---|
| `primaryAgentSlug` | `spec.agent.slug` |
| `workspaceManifestRef` | the manifest itself |
| `defaultRole` | `spec.agent.role` |
| `workspacePersistPaths` | `spec.persistence.paths` |
| `defaultSkillSlugs` | `spec.skills` (slug + optional semver pin) |
| `defaultMcpServerIds` | `spec.toolSelection` (provider/tool entries) |
| `defaultModel` | `spec.agent.defaultModel` |
| `defaultSubAgents` | `spec.agent.subAgents` |
| `displayName`, `description`, `sortOrder` | `metadata.display.{title, blurb, sortOrder}` |
| `visible` | `metadata.display.hidden` (inverted) |

When you publish a manifest with these blocks filled in, every session that previously pinned the equivalent profile gets the same runtime topology — but now from a single, versioned, scope-laddered source.

---

**Previous**: [← Mounts Reference](./04-mounts-reference.md)
