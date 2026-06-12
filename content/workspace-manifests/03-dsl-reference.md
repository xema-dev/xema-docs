# Workspace Manifest DSL Reference

The workspace manifest DSL is a schema-driven YAML specification. This page documents the schema structure, validation rules, and expression syntax.

---

## Manifest Structure

Every workspace manifest has this root structure:

```yaml
# yaml-language-server: $schema=https://xema.dev/schemas/workspace/v1/WorkspaceManifest.json
apiVersion: xema.dev/workspace/v1
kind: WorkspaceManifest
extends: xema://manifest/primary-agent-base@1.0.0   # optional
metadata:
  slug: my-manifest
  version: 1.0.0
  title: "My Workspace"
  description: Optional description
spec:
  inputs: {}       # variables callers supply
  mounts: {}       # which workspace slots are mounted
  agent: {}        # agent identity and role
  seedFiles: []    # files to bootstrap in /workspace
  env: []          # environment variables
```

| Field | Type | Required | Description |
|---|---|---|---|
| `apiVersion` | string | Yes | Always `xema.dev/workspace/v1` |
| `kind` | string | Yes | Always `WorkspaceManifest` |
| `extends` | string | No | Base manifest ref to inherit from (single-level) |
| `metadata.slug` | string | Yes | Manifest identifier (lowercase kebab-case, 1–64 chars) |
| `metadata.version` | string | Yes | SemVer format (`MAJOR.MINOR.PATCH`) |
| `metadata.title` | string | No | Human-readable label |
| `metadata.description` | string | No | Optional one-line summary |
| `spec.inputs` | object | No | Input variable definitions |
| `spec.mounts` | object | No | Workspace mounts configuration |
| `spec.agent` | object | Yes | Agent identity |
| `spec.seedFiles` | array | No | Files to bootstrap |
| `spec.env` | array | No | Environment variables |

---

## `extends:` — manifest inheritance

A manifest may inherit from a base template by setting `extends` to a
`xema://manifest/<slug>@<version>` reference. Resolution happens at
compile time: the base is fetched (user → project → org → biome →
system precedence — the standard five-tier ladder), merged into the
child, and the resulting effective shape is what the runtime consumes.

```yaml
extends: xema://manifest/primary-agent-base@1.0.0
metadata:
  slug: clarification-coordinator
  version: 1.0.0
spec:
  agent:
    slug: clarification-coordinator
    phase: clarification
    role: coordinator
  mounts:
    deliverable-specs: { mode: read-only }   # added on top of base
```

### Merge rules

- **`mounts`** and **`inputs`** — key-union. Child's per-slot
  declaration wins on conflict.
- **`seedFiles`** and **`env`** — concatenated (base first), with
  duplicates by `path` / `name` keeping the LAST occurrence (child wins).
- **`agent`** — child's block fully replaces the base's. The agent
  identity is not inheritable.

### Constraints

- **Single-level only** — the base manifest itself MUST NOT carry an
  `extends:` field. Multi-level inheritance is rejected at compile time.
- **Version-pinned** — the URI requires a concrete `@MAJOR.MINOR.PATCH`
  so old runs always resolve to the row they were authored against.
- **Fail-fast** — missing base → typed error; malformed base → typed
  error.

### Built-in templates

The platform ships four base templates at the system tier:

| Slug | Use Case |
|---|---|
| `primary-agent-base` | Coordinator / unit-worker shape (inputs RO, references RO, uploads RO, deliverables RW) |
| `subagent-base` | Same as `primary-agent-base` minus uploads |
| `reviewer-base` | Read-only verdict shape (inputs/references/repos/deliverable-specs/deliverables, all read-only) |
| `agent-session-base` | Chat-driven runs (inputs RO, references RO, uploads RO, deliverables RW) |

Biomes register their own base manifests by shipping additional
`*.workspace.yaml` files under `workspace-manifests/` — at install
time each one is compiled and seeded into the LLM Registry as a
published agent composition, and other manifests can `extends:` it by
`xema://manifest/<slug>@<version>`. Orgs publish org-private base
manifests the same way: ship them via an org-scoped biome or author
them directly in the Agent Studio.

---

## Inputs

Declare variables that callers supply at dispatch or session start. All `${{ input.x }}` references in the manifest must have a corresponding input declaration.

```yaml
spec:
  inputs:
    repoRef:
      type: string
      required: true
      description: Repository owner/name
      pattern: "^[a-zA-Z0-9-]+/[a-zA-Z0-9-]+$"
    
    theme:
      type: string
      required: false
      default: light
      enum: [light, dark]
      description: Visual theme preference
    
    maxTokens:
      type: number
      required: false
      default: 4000
      minimum: 100
      maximum: 10000
    
    enableDebug:
      type: boolean
      required: false
      default: false
    
    kbSpaceIds:
      type: array
      required: false
      default: []
      description: Knowledge-base space IDs to include
```

### Input Type Reference

| Type | Example | Notes |
|---|---|---|
| `string` | `"github.com/example/repo"` | Can include `pattern`, `enum`, `minLength`, `maxLength` |
| `number` | `4000` | Can include `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` |
| `boolean` | `true` or `false` | No additional constraints |
| `array` | `["space1", "space2"]` | Items are strings or objects; no nesting |
| `object` | `{ key: "value" }` | Free-form; reserved for complex structures |

### Input Constraints

```yaml
spec:
  inputs:
    # String with pattern
    githubToken:
      type: string
      required: true
      pattern: "^ghp_[a-zA-Z0-9]{36}$"
      description: GitHub personal access token
    
    # Number with bounds
    concurrency:
      type: number
      required: false
      default: 4
      minimum: 1
      maximum: 16
    
    # Enum (closed set)
    architecture:
      type: string
      required: true
      enum: [monolith, microservices, serverless]
```

---

## Expression Syntax

Manifest values can include **expressions** that are resolved at bind time. Expressions use `${{ ... }}` syntax and can reference:

- **Inputs:** `${{ input.repoRef }}`
- **Literals:** `${{ 'string-value' }}`
- **Environment:** `${{ env.USER }}` (platform-supplied, not user inputs)

### Examples

```yaml
spec:
  inputs:
    repo:
      type: string
      required: true
    debug:
      type: boolean
      default: false

  mounts:
    repos:
      work:
        - url: "https://github.com/${{ input.repo }}"
          role: primary
  
  seedFiles:
    - path: /workspace/config.json
      content: |
        {
          "debug": ${{ input.debug }},
          "repo": "${{ input.repo }}"
        }
  
  env:
    - name: DEBUG_MODE
      value: "${{ input.debug }}"
```

### Expression Resolution Rules

1. **Type coercion:** Expressions in YAML values are resolved to their declared type
2. **Missing input:** If `required: true` input is missing → compile error
3. **Default fallback:** If `required: false` input is missing → use `default` value
4. **Null handling:** `null` values are rejected unless explicitly allowed
5. **No nested expressions:** `${{ ${{ ... }} }}` is invalid
6. **String interpolation:** Expressions can be embedded in strings: `"prefix-${{ input.x }}-suffix"`

---

## Validation Tiers

The manifest compiler validates in three tiers:

### Tier 1: Structural

YAML syntax, required fields, type compatibility.

**Examples of Tier 1 errors:**
- YAML syntax error (bad indentation, invalid escape)
- Missing required field (`spec.agent` not present)
- Type mismatch (`agent.slug` is a number instead of string)

**When caught:** At manifest compile time — in your editor via the schema hint, and again when the biome that ships the manifest is installed.

### Tier 2: Policy

Format rules, enums, closed-set validation.

**Examples of Tier 2 errors:**
- Slug format invalid: `"My Manifest"` → must be kebab-case `"my-manifest"`
- Version not SemVer: `"1.0"` → must be `"1.0.0"`
- Unknown enum value: `role: "unknown"` → must be one of `unit-worker`, `coordinator`, `gate-reviewer`, `clarification-coordinator`, `scope-validator`, `agent-session`, `brainstorming`, `generic-agent`, `auditor`, or `engineer`. The compile error names the offending field as `$.spec.agent.role`.

**When caught:** At manifest compile time — in your editor via the schema hint, and again when the biome that ships the manifest is installed.

### Tier 3: Semantic (Deferred to Runtime)

Agent existence, phase availability, mount source availability.

**Examples of Tier 3 checks (deferred):**
- Agent slug `"nonexistent"` → resolved at dispatch, fails if not found in LLM Registry
- Phase key `"invalid"` → resolved at dispatch
- Mount source (KB space, external repo) → resolved at dispatch

**When caught:** At workflow dispatch or session start (not at biome install / composition seed time)

**Why deferred:** These depend on runtime state (which org, which agent versions are available). The DSL validates what it can offline; the runtime validates the rest.

---

## Schema URL

The manifest schema is published at the apiVersion-aligned URL (Kubernetes convention `<group>/<version>/<Kind>`):

```
GET https://xema.dev/schemas/workspace/v1/WorkspaceManifest.json
```

Add the schema hint to your YAML files for IDE autocomplete:

```yaml
# yaml-language-server: $schema=https://xema.dev/schemas/workspace/v1/WorkspaceManifest.json
```

**Schema Updates:** breaking changes bump the apiVersion (e.g. `xema.dev/workspace/v2`) and ship at a new URL. Old apiVersions stay served until fully deprecated.

---

## Error Messages

When manifest compilation fails — at biome install time, or in your editor via the schema hint — each error carries a structured code:

```json
{
  "ok": false,
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "path": "spec.agent.slug",
      "message": "agent slug must not be empty"
    },
    {
      "code": "TEMPLATE_NOT_FOUND",
      "path": "spec.seedFiles[0].template",
      "name": "my-custom-template"
    }
  ]
}
```

| Code | Meaning | Next Step |
|---|---|---|
| `VALIDATION_ERROR` | Tier 1 or 2 failure | Fix the YAML |
| `TEMPLATE_NOT_FOUND` | Required template doesn't exist | Ship the template as a skill-bundle resource referenced by the manifest |
| `INTERPOLATION_ERROR` | Expression syntax error | Check `${{ ... }}` syntax |
| `SEMANTIC_ERROR` | Tier 3 (runtime) failure | Will be caught at dispatch; can't fix offline |

---

## Best Practices

1. **Always include the schema hint** in your YAML files for IDE completion
2. **Use required inputs sparingly** — most inputs should have sensible defaults
3. **Validate early** — let the editor's YAML language server flag schema errors as you author
4. **Version your manifests** — use SemVer; breaking changes bump MAJOR
5. **Document your inputs** — include descriptions for all inputs so callers understand what they're for
6. **Use enums for closed sets** — prefer `enum:` over free-form strings for better validation

---

**Related:** [Authoring Guide](./02-authoring.md) · [Mounts Reference](./04-mounts-reference.md)

---

**Previous**: [← Authoring](./02-authoring.md)
**Next**: [Mounts Reference →](./04-mounts-reference.md)
