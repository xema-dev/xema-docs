# Authoring Workspace Manifests

A workspace manifest is a YAML file with the header below. Add the schema comment for IDE completion:

```yaml
# yaml-language-server: $schema=https://xema.dev/schemas/workspace/v1/WorkspaceManifest.json
apiVersion: xema.dev/workspace/v1
kind: WorkspaceManifest
metadata:
  slug: my-manifest
  version: 1.0.0
  description: Optional one-line description
spec:
  inputs: { ... }
  mounts: { ... }
  agent: { ... }
  seedFiles: [ ... ]
  env: [ ... ]
```

---

## `spec.inputs`

Declares the variables callers must (or may) supply at bind time. All `${input.x}` references in the rest of the manifest must be declared here.

```yaml
spec:
  inputs:
    repoRef:
      type: string
      required: true
      description: SCM repo the agent operates on (e.g. owner/repo).
    theme:
      type: string
      required: false
      default: light
      enum: [light, dark]
    kbSpaceIds:
      type: string[]
      required: false
      default: []
```

| Field | Type | Description |
|---|---|---|
| `type` | `string`, `number`, `boolean`, `string[]` | Value type |
| `required` | boolean | Whether the caller must supply a value |
| `default` | any | Value used when the caller omits the input |
| `enum` | array | Closed set of allowed string values |
| `description` | string | Human label shown in the platform UI |

---

## `spec.mounts`

Controls which workspace slots are active and their access mode.

```yaml
spec:
  mounts:
    repos:
      mode: read-write          # agent can commit and push
    references:
      mode: read-only           # KB spaces, external repos
    deliverable-specs:
      mode: read-only
    deliverables:
      mode: read-write          # agent writes output here; harvested at end
    uploads:
      mode: read-only           # files the user attached to the session
    inputs:
      mode: read-only           # inputs.json is written here automatically
```

Omit a slot to leave it unmounted. The `agent` field (below) is always mounted automatically — you do not declare it under `mounts`.

You can also use `true` as a shorthand to enable a slot with platform defaults:

```yaml
spec:
  mounts:
    repos: true              # equivalent to { mode: read-write }
    deliverables: true
```

### `references` with KB space IDs

To bind specific knowledge-base spaces at dispatch time, add `kbSpaces` alongside `mode`:

```yaml
spec:
  mounts:
    references:
      mode: read-only
      kbSpaces: ${input.kbSpaceIds}   # resolved from inputs at bind time
```

Similarly, `externalProjects` pins specific external SCM repos under `references/external-projects/`:

```yaml
    references:
      mode: read-only
      externalProjects: ${input.repoRef}
```

---

## `spec.agent`

Declares the agent identity. The platform resolves the agent definition, its skills, and its instruction sections from the LLM Registry before the workspace is handed to the agent runtime.

```yaml
spec:
  agent:
    slug: engineer              # agent slug registered in the LLM Registry
    phase: engineering          # phase key (controls which config tier is used)
    role: engineer              # see Role values below
    deliverableSpecRef: ${input.deliverableSpecRef}   # optional
```

| Field | Required | Description |
|---|---|---|
| `slug` | Yes | Agent identifier in the LLM Registry |
| `phase` | Yes | Phase key used for agent config resolution |
| `role` | Yes | One of the canonical role values — see below |
| `deliverableSpecRef` | No | Spec slug passed to AGENTS.md rendering |

### Role values

| Role | When to use |
|---|---|
| `unit-worker` | Pipeline executor producing files under a builder template |
| `coordinator` | Pipeline coordinator merging unit outputs / authoring system-wide pages |
| `engineer` | Code-producing pipeline executor (writes commits, runs builds) |
| `auditor` | Read-only repo scanner |
| `generic-agent` | User-defined pipeline agent that doesn't fit the closed catalogue |
| `gate-reviewer` | Read-only verdict over upstream deliverables; emits `review.json` |
| `clarification-coordinator` | Pre-pipeline clarification phase that emits the typed handoff package |
| `scope-validator` | Validates whether an upstream output stays inside an envelope; read-only |
| `agent-session` | Free-chat session bound to a primary agent |
| `brainstorming` | Brainstorming session — design canvas, no pipeline retry/manifest concepts |

Manifests that name a role outside this list fail at compile time — in the editor via the schema hint, and again when the biome shipping the manifest is installed — with a typed error pointing at `$.spec.agent.role`.

---

## `spec.seedFiles`

Files written into the workspace before the agent starts. Each entry renders content from a named Handlebars template or inline `content` string.

```yaml
spec:
  seedFiles:
    # From a named template
    - path: preview/index.html
      slot: deliverables          # which workspace slot the path is relative to
      template: brainstorming-preview-app
      vars:
        theme: ${input.theme}

    # From inline content
    - path: pinned-notes.md
      slot: deliverables
      content: |
        # Session Notes
        Use this file to capture key decisions.
```

| Field | Required | Description |
|---|---|---|
| `path` | Yes | File path relative to the slot root |
| `slot` | Yes | Target slot (`deliverables`, `repos`, etc.) |
| `template` | Either | Named template registered in the platform |
| `content` | Either | Inline Handlebars or literal string |
| `vars` | No | Variables passed to the Handlebars template |

Template names are skill-bundle resources served by the Skill Registry — each biome ships its templates under `templates/*.hbs` (declared in the biome manifest's `workspaceManifestTemplates` field) and the platform resolves them at seed-render time through the same five-tier scope ladder as every other Skills-First primitive (user → project → org → biome → system).

---

## `spec.env`

Environment variables injected into the agent's container. Names **must** be `UPPER_SNAKE_CASE` (validated at compile time).

```yaml
spec:
  env:
    - name: BRAINSTORM_THEME
      value: ${input.theme}
    - name: REVIEW_MODE
      value: strict
```

---

## Complete Examples

### Seeded canvas (demo biome)

This `demo-seeded-canvas` manifest from the `demo` biome showcases `seedFiles` end-to-end: three theme-aware files (`preview/index.html`, `preview/styles.css`, `preview/app.js`) are materialised into the deliverables slot from named Handlebars templates BEFORE the agent runs. The agent inherits a working scaffold and the live-preview launcher picks it up as a `static_http` app on first scan.

```yaml
# yaml-language-server: $schema=https://xema.dev/schemas/workspace/v1/WorkspaceManifest.json
apiVersion: xema.dev/workspace/v1
kind: WorkspaceManifest
extends: xema://manifest/agent-session-base@1.0.0
metadata:
  slug: demo-seeded-canvas
  version: 1.0.0
  description: >-
    Demo workspace manifest showcasing the spec.seedFiles feature.
spec:
  inputs:
    theme:
      type: string
      required: false
      default: light
      enum: [light, dark]
    title:
      type: string
      required: false
      default: My Xema Canvas
  agent:
    slug: demo-runner
    phase: interactive
    role: agent-session
  seedFiles:
    - path: preview/index.html
      slot: deliverables
      template: demo-seeded-canvas-index.html
      vars:
        theme: ${input.theme}
        title: ${input.title}
    - path: preview/styles.css
      slot: deliverables
      template: demo-seeded-canvas-styles.css
      vars:
        theme: ${input.theme}
    - path: preview/app.js
      slot: deliverables
      template: demo-seeded-canvas-app.js
      vars:
        title: ${input.title}
  env:
    - name: DEMO_CANVAS_THEME
      value: ${input.theme}
```

The `demo-25-seeded-workspace` workflow in the demo biome references this manifest via `workspaceManifestRef: demo-seeded-canvas@1.0.0` and asks the agent to extend the scaffold without rewriting it — a canonical "first paint correct, agent contributes the delta" pattern.

### Brainstorming session

This is the `brainstorming-default` manifest shipped by the `brainstorming` biome verbatim:

```yaml
# yaml-language-server: $schema=https://xema.dev/schemas/workspace/v1/WorkspaceManifest.json
apiVersion: xema.dev/workspace/v1
kind: WorkspaceManifest
metadata:
  slug: brainstorming-default
  version: 1.0.0
  description: >
    Brainstorming session workspace — open canvas, uploads slot for
    user-uploaded references, deliverables for harvest.
spec:
  inputs:
    theme:
      type: string
      required: false
      default: light
      enum: [light, dark]
    kbSpaceIds:
      type: string[]
      required: false
      default: []
  mounts:
    references:
      mode: read-only
    uploads:
      mode: read-only
    deliverables:
      mode: read-write
    inputs:
      mode: read-only
  agent:
    slug: brainstorming
    phase: interactive
    role: coordinator
  seedFiles:
    - path: preview/index.html
      slot: deliverables
      template: brainstorming-preview-app
      vars:
        theme: ${input.theme}
    - path: preview/styles.css
      slot: deliverables
      template: brainstorming-styles
      vars:
        theme: ${input.theme}
  env:
    - name: BRAINSTORM_THEME
      value: ${input.theme}
```

### Engineering executor (repo + KB + deliverables)

This is the `engineering-standard` manifest shipped by the `software-dev` biome:

```yaml
# yaml-language-server: $schema=https://xema.dev/schemas/workspace/v1/WorkspaceManifest.json
apiVersion: xema.dev/workspace/v1
kind: WorkspaceManifest
metadata:
  slug: engineering-standard
  version: 1.0.0
  description: >
    Standard engineering executor workspace — read-write repo, KB references
    for engineering docs/runbooks, deliverables slot writeable for the agent's output.
spec:
  inputs:
    repoRef:
      type: string
      required: true
      description: SCM repo identifier the agent operates on (e.g. owner/repo).
    kbSpaceIds:
      type: string[]
      required: false
      default: ['engineering-docs', 'runbooks']
      description: Knowledge-base spaces to mount under references/kb/.
    deliverableSpecRef:
      type: string
      required: true
      description: Deliverable-spec slug+version the agent must conform to.
  mounts:
    repos:
      mode: read-write
    references:
      mode: read-only
    deliverable-specs:
      mode: read-only
    deliverables:
      mode: read-write
    inputs:
      mode: read-only
  agent:
    slug: engineer
    phase: engineering
    role: engineer
    deliverableSpecRef: ${input.deliverableSpecRef}
```

---

## Validating Before Shipping

Workspace manifests are validated at build time by the `@xemahq/workspace-manifest-dsl` compiler — the same schema enforced when the biome that ships the manifest is installed. Annotate every manifest YAML with the schema hint so your editor's YAML language server flags structural errors as you type:

```yaml
# yaml-language-server: $schema=https://xema.dev/schemas/workspace/v1/WorkspaceManifest.json
apiVersion: xema.dev/workspace/v1
kind: WorkspaceManifest
```

When a biome is installed, each `manifests/*.workspace.yaml` file is compiled and projected into a published agent composition. A manifest that fails validation — an empty `agent.slug`, a missing required input, or a seed file referencing an unknown template — fails the install fast with a typed error so the bad manifest never reaches a session.

See [DSL Reference](./03-dsl-reference.md) for the full error taxonomy.

---

**Previous**: [← Concepts](./01-concepts.md)
**Next**: [DSL Reference →](./03-dsl-reference.md)
