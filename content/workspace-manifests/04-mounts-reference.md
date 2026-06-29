# Mount Slots Reference

This page documents every workspace mount slot, its configuration options, and usage patterns.

---

## Mount Slots Overview

A **mount slot** is a directory or resource that gets materialized into the agent's `/workspace/`. Manifest authors declare which slots to mount and in what mode (read-only or read-write).

```yaml
spec:
  mounts:
    deliverables:      # slot name
      mode: read-write  # access mode
```

---

## All Mount Slots

### `inputs`

**Path:** `/workspace/inputs/`  
**Mode:** Always read-only  
**Description:** Structured input data supplied by the caller (workflow inputs, session context).

**Configuration:**
```yaml
spec:
  mounts:
    inputs: true    # always read-only, no additional config
```

**File structure:**
```
/workspace/inputs/
├── inputs.json      # caller-supplied inputs as JSON
└── (optional) / individual input files
```

**Use case:** Agent reads structured inputs from the workflow dispatch or session launch.

---

### `repos`

**Path:** `/workspace/repos/`  
**Mode:** read-only or read-write  
**Description:** Git repositories the agent operates on or references.

**Configuration:**
```yaml
spec:
  mounts:
    repos:
      mode: read-write    # agent can commit, push, create branches
      work:               # repository role/group
        - url: ${input.repo_url}
          role: primary   # which repo is the "main" one
        - url: https://github.com/example/dependency
          role: reference
```

**File structure:**
```
/workspace/repos/
├── <repoName1>/     # cloned from primary repo
├── <repoName2>/     # cloned from reference repo
└── ...
```

| Field | Type | Description |
|---|---|---|
| `mode` | string | `read-only` or `read-write` |
| `work` | array | Repos to mount (role not used currently, reserved) |
| `work[].url` | string | SCM repository URL |
| `work[].role` | string | `primary` or `reference` (informational) |

**Use case:** Agent working on codebase, running tests, committing changes.

---

### `references`

**Path:** `/workspace/references/`  
**Mode:** Always read-only  
**Description:** Knowledge-base spaces and external reference repositories (no write).

**Configuration:**
```yaml
spec:
  mounts:
    references:
      mode: read-only                          # always read-only
      kb:                                      # knowledge-base spaces
        spaces: ${input.kbSpaceIds}       # e.g. ["best-practices", "api-docs"]
      externalProjects:                        # external reference repos
        repos: ${input.referenceRepo}     # e.g. "owner/reference-repo"
```

**File structure:**
```
/workspace/references/
├── kb/
│   ├── best-practices/          # KB space content
│   ├── api-docs/
│   └── ...
└── external-projects/
    ├── <externalRepoName1>/
    ├── <externalRepoName2>/
    └── ...
```

| Field | Type | Description |
|---|---|---|
| `mode` | string | Always `read-only` (no additional options) |
| `kb.spaces` | string[] | KB space slugs to mount (resolved at runtime) |
| `externalProjects.repos` | string | SCM repo URL or slug (resolved at runtime) |

**Use case:** Agent researching architecture patterns, reading documentation, referencing external examples.

---

### `deliverable-specs`

**Path:** `/workspace/deliverable-specs/`  
**Mode:** Always read-only  
**Description:** Output contracts and deliverable templates (what the agent is expected to produce).

**Configuration:**
```yaml
spec:
  mounts:
    deliverable-specs: true   # no additional config needed
```

**File structure:**
```
/workspace/deliverable-specs/
├── <specSlug1>.json
├── <specSlug2>.json
└── ...
```

**Spec format:**
Each spec is a JSON file defining:
- Output format (e.g., markdown, JSON, code)
- Validation schema (Zod or JSON-Schema)
- Required sections/fields

**Use case:** Agent reads the output contract before starting work; platform validates agent output against these specs.

---

### `deliverables`

**Path:** `/workspace/deliverables/`  
**Mode:** read-only or read-write  
**Description:** Agent outputs and intermediate artifacts (harvested at session end).

**Configuration:**
```yaml
spec:
  mounts:
    deliverables: true       # read-write (always writable)
```

**File structure:**
```
/workspace/deliverables/
├── manifest.json             # required; created by platform or agent
├── my-output.md              # custom deliverable files
├── code/
│   ├── module.py
│   └── ...
└── ...
```

**Special file:**
- **`manifest.json`** — declares what was produced and how to classify each file:
  ```json
  {
    "deliverables": [
      { "path": "my-output.md", "kind": "code-review" },
      { "path": "code/module.py", "kind": "implementation" }
    ]
  }
  ```

**Use case:** Agent writes analysis, code, documentation, or any output. Platform automatically harvests on session end.

---

### `uploads`

**Path:** `/workspace/uploads/`  
**Mode:** Always read-only  
**Description:** Files uploaded by the user to the interactive session (documents, code snippets, images).

**Configuration:**
```yaml
spec:
  mounts:
    uploads: true        # no additional config
```

**File structure:**
```
/workspace/uploads/
├── document.pdf
├── code-snippet.py
├── screenshot.png
└── ...
```

**Use case:** User attaches supporting files during a session; agent reads and analyzes them.

---

### Agent-runtime config dir

**Path:** `/workspace/<agent-runtime-config>/` (internal — exact location is managed by the platform)  
**Mode:** read-only (internal agent runtime config)  
**Description:** Xema Agent Runtime configuration (agents, skills, instructions). Managed automatically by the platform.

**File structure (not user-configurable):**
```
/workspace/<agent-runtime-config>/
├── runtime.jsonc               # runtime config (managed by pool-api)
├── agents/                      # agent definitions
│   ├── engineer.md
│   └── ...
├── skills/                      # skill definitions
│   ├── code-review/
│   │   └── SKILL.md
│   └── ...
└── instructions/                # custom instructions
    ├── custom-rule.md
    └── ...
```

**Note:** You do NOT declare this mount in your manifest. It is always present and managed by the platform.

---

## Mount Configuration Patterns

### Minimal (No Custom Config)

Use `true` as a shorthand to enable with platform defaults:

```yaml
spec:
  mounts:
    inputs: true
    references: true
    deliverable-specs: true
    deliverables: true
    uploads: true
```

---

### Explicit Mode

Specify the access mode explicitly:

```yaml
spec:
  mounts:
    repos:
      mode: read-write
    references:
      mode: read-only
```

---

### Dynamic Configuration

Use expressions to bind mount config at runtime:

```yaml
spec:
  inputs:
    kbSpaces:
      type: array
      default: ["best-practices"]
    primaryRepo:
      type: string
      required: true

  mounts:
    references:
      kb:
        spaces: ${input.kbSpaces}     # resolved at dispatch
    repos:
      work:
        - url: ${input.primaryRepo}  # resolved at dispatch
```

---

## Omitting Mounts

If you don't declare a mount, it is **not mounted**:

```yaml
spec:
  mounts:
    repos: true          # ✓ /workspace/repos/ exists
    # deliverables not listed → /workspace/deliverables/ not mounted

  # So the agent cannot write deliverables!
  # (Unless deliverables is needed, always include it)
```

---

## Mount Access Modes

### read-only

Agent can read but cannot modify:
```bash
cat /workspace/references/kb/best-practices.md  # ✓ works
echo "test" > /workspace/references/new.md     # ✗ read-only filesystem
```

**Slots that are always read-only:**
- `inputs`
- `references`
- `deliverable-specs`
- `uploads`
- Agent-runtime config dir

### read-write

Agent can create, modify, delete files:
```bash
cat /workspace/repos/myrepo/code.py            # ✓ read
echo "changes" >> /workspace/repos/myrepo/code.py   # ✓ write
git -C /workspace/repos/myrepo add .            # ✓ commit
```

**Slots that can be read-write:**
- `repos`
- `deliverables`

---

## Common Manifest Patterns

### Brainstorming Session
```yaml
spec:
  mounts:
    inputs: true           # user inputs for brainstorm
    deliverables: true     # brainstorm notes
    # no repos, no references — this is creative, offline work
```

### Engineering Review
```yaml
spec:
  mounts:
    repos:                 # read code
      mode: read-only
      work:
        - url: ${input.repo_url}
    references: true       # reference patterns/guidelines
    deliverables: true     # write review comments
```

### Code Implementation
```yaml
spec:
  mounts:
    repos:                 # work on codebase
      mode: read-write
      work:
        - url: ${input.repo_url}
    deliverable-specs: true    # understand output contract
    deliverables: true         # write implementation
```

### Research + Documentation
```yaml
spec:
  mounts:
    references:            # research materials
      kb:
        spaces: ${input.kbSpaces}
    deliverables: true     # write findings
    # no repos — this is documentation work, not coding
```

---

## Troubleshooting

**Q: Agent says "permission denied" on /workspace/xxx**  
A: The mount is `read-only` and the agent is trying to write. Check `spec.mounts.<slot>.mode` and update to `read-write` if needed.

**Q: I don't see `/workspace/repos/` in the agent**  
A: `repos` is not mounted in your manifest. Add `spec.mounts.repos: true` or `spec.mounts.repos: { mode: read-write }`.

**Q: How do I mount a specific KB space?**  
A: Use `spec.mounts.references.kb.spaces: ["space-slug"]`. At dispatch, provide the space IDs in inputs.

**Q: Can the agent create new files in /workspace/deliverables?**  
A: Yes, if `spec.mounts.deliverables: true` (or `read-write`). The agent can create any files. Use `manifest.json` to declare which ones are actual deliverables.

---

**Related:** [Authoring Guide](./02-authoring.md) · [DSL Reference](./03-dsl-reference.md)

---

**Previous**: [← DSL Reference](./03-dsl-reference.md)
**Next**: [Environment Blocks →](./05-environment-blocks.md)
