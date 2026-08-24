# Language Reference

> API Docs: https://workflow-engine-api.xema.dev/api/docs

Complete DSL syntax specification.

## Table of Contents

1. [Authoring Shorthands](#authoring-shorthands)
2. [Root Properties](#root-properties)
3. [Metadata](#metadata)
4. [Triggers (on)](#triggers-on)
5. [Concurrency](#concurrency)
6. [Defaults](#defaults)
7. [Permissions](#permissions)
8. [Variables](#variables)
9. [Jobs](#jobs)
10. [Expressions](#expressions)

---

## Authoring Shorthands

The DSL accepts a small set of shorthand forms so common cases stay terse.
**Every shorthand normalizes to the canonical form at compile time** — the
compiled run snapshot is the verbose form, so replays and debugging never
depend on the shorthand. Authors write less; the engine sees more.

| Shorthand | Expands to | Notes |
|---|---|---|
| `needs: job1` | `needs: [job1]` | Single-dependency form |
| `uses: xema/agent` | Resolved to the action's current version at compile time | The compiled run pins the concrete version — replays are deterministic |
| `if: ${{ needs.draft }}` | `if: ${{ needs.draft.outcome == 'ok' }}` | Only the bare reference is rewritten; compound expressions stay as authored |
| Job with no `with:` | Treated as `with: {}` | Validation still rejects the job if the action's `inputs` schema has required fields |
| Job with no `outputs:` | Downstream consumers see the activity's raw output envelope under `needs.<job>.outputs.*` | Add an explicit `outputs:` block when you need to rename or project |

Ranges in `uses:` (e.g. `@1.0`, `^1.0.0`) are **not supported** — a workflow
that compiles today but resolves to a different version tomorrow would break
replay safety. Use either an exact `@<semver>` or omit `@<ver>` entirely.

---

## Root Properties

### apiVersion

**Type**: `string`  
**Required**: Yes  
**Value**: `xema.dev/workflow/v1alpha1`

Specifies the DSL version.

```yaml
apiVersion: xema.dev/workflow/v1alpha1
```

### kind

**Type**: `string`  
**Required**: Yes  
**Value**: `Workflow`

Specifies this is a workflow definition.

```yaml
kind: Workflow
```

### metadata

**Type**: `object`  
**Required**: Yes

Workflow metadata.

```yaml
metadata:
  name: my-workflow              # Unique name
  version: 1.0.0                 # Semantic versioning
  description: Optional description
```

### on

**Type**: `object`  
**Required**: Yes

Trigger definitions. At least one trigger required.

### concurrency

**Type**: `object`  
**Required**: No

Concurrency control.

### defaults

**Type**: `object`  
**Required**: No

Default settings for all jobs.

### permissions

**Type**: `object`  
**Required**: No

Resource access declarations.

### vars

**Type**: `object`  
**Required**: No

Static variables.

### jobs

**Type**: `object`  
**Required**: Yes

Workflow jobs (at least one required).

---

## Metadata

```yaml
metadata:
  name: workflow-name                    # Required: unique identifier
  version: 1.0.0                         # Required: semantic version
  description: Human-readable description # Optional
```

### name

**Type**: `string` (alphanumeric, hyphens)  
**Required**: Yes  
**Pattern**: `^[a-z0-9-]+$`

Unique workflow identifier within project.

### version

**Type**: `string`  
**Required**: Yes  
**Pattern**: `^\d+\.\d+\.\d+(-[a-z0-9]+)?$`

Semantic version (MAJOR.MINOR.PATCH).

### description

**Type**: `string`  
**Required**: No

Human-readable description.

---

## Triggers (on)

At least one trigger required.

### workflow_dispatch

Manual workflow trigger:

```yaml
on:
  workflow_dispatch:
    inputs:
      project_name:
        type: string
        required: true
        description: Project name
      budget:
        type: number
        required: false
        defaultValue: 100000
      include_testing:
        type: boolean
        required: false
        defaultValue: true
```

#### Inputs Schema

```typescript
interface InputDescriptor {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array'
  required: boolean
  description?: string
  defaultValue?: unknown
  enum?: string[]                    // For closed sets
  format?: 'multiline'               // For string type
  itemType?: string                  // For array type
}
```

### schedule

Cron-based trigger:

```yaml
on:
  schedule:
    - cron: "0 9 * * MON"           # Monday 9 AM
      inputs:
        report_type: weekly
    - cron: "0 0 1 * *"             # 1st of month
      inputs:
        report_type: monthly
```

**Cron Format**: `minute hour day-of-month month day-of-week`

Examples:
- `0 9 * * MON` — Monday 9 AM
- `0 0 * * *` — Daily midnight
- `0 0 1 * *` — First day of month
- `*/15 * * * *` — Every 15 minutes

### webhook

External event trigger:

```yaml
on:
  webhook:
    - event: scm.push
      filters:
        projectId: proj_123
        branch: main
    - event: tracker.issue
      filters:
        type: feature
        priority: high
```

**Supported Events**:
- `scm.push` — Code push
- `scm.pull_request` — Pull request
- `tracker.issue` — Issue event
- `doc.page` — Document event

### workflow_call

Called by other workflows:

```yaml
on:
  workflow_call:
    inputs:
      scope:
        type: string
        required: true
    outputs:
      summary:
        value: ${{ needs.final.outputs.summary }}
```

---

## Concurrency

Control concurrent executions:

```yaml
concurrency:
  group: requirements-${{ inputs.project_id }}
  mode: queue
```

### group

**Type**: `string`  
**Required**: Yes

Concurrency group name. Supports expressions.

### mode

**Type**: `string` (enum)  
**Required**: Yes  
**Values**: `allow | queue | cancel_in_progress | skip`

- `allow` — Multiple concurrent runs
- `queue` — Sequential execution
- `cancel_in_progress` — Cancel old, start new
- `skip` — Skip if one running

---

## Defaults

Default settings applied to all jobs:

```yaml
defaults:
  retry:
    maxAttempts: 3
    backoffCoefficient: 2.0
    initialInterval: 1s
    maxInterval: 60s
  timeout: "2h"
```

### retry

```typescript
interface RetryPolicy {
  maxAttempts: number              // Max attempts (1-10)
  backoffCoefficient: number       // Multiplier per retry (1.0-10.0)
  initialInterval: string          // Starting wait (e.g., "1s")
  maxInterval: string              // Max wait (e.g., "60s")
}
```

### timeout

**Type**: `string` (duration)  
**Format**: `"1s" | "1m" | "1h" | "1d"`

Workflow-level timeout.

---

## Permissions

Resource access declarations:

```yaml
permissions:
  repos: read                      # SCM access
  kb: limited                      # Knowledge base
  backlog: write                   # Issue tracking
  artifacts: read                  # Artifact store
  integrations: read               # Integrations
```

### Available Scopes

| Scope | Levels | Purpose |
|-------|--------|---------|
| `repos` | none, read, limited, write | SCM repository access |
| `kb` | none, read, limited, write | Knowledge base access |
| `backlog` | none, read, limited, write | Issue/backlog access |
| `artifacts` | none, read, limited, write | Artifact store access |
| `integrations` | none, read, limited, write | External integrations |

---

## Variables

Static variables:

```yaml
vars:
  organization: "Acme Corp"
  max_retries: 3
  review_template: "enterprise"
```

Access via: `${{ vars.key }}`

---

## Jobs

```yaml
jobs:
  job-key:
    title: Optional title
    needs: [job1, job2]              # Dependencies
    if: ${{ condition }}             # Conditional
    strategy:                        # Matrix/dynamic
      matrix:
        os: [ubuntu, windows]
    uses: namespace/action@version   # Action ref
    with:                            # Inputs
      param: value
    outputs:                         # Extract outputs
      key: ${{ result.field }}
    timeout: "1h"                    # Job timeout
    retry:                           # Job retry policy
      maxAttempts: 5
```

### Job Properties

#### id / name

**Type**: `string`

The job identifier (from the key).

#### title

**Type**: `string`

Optional human-readable title.

#### needs

**Type**: `string[]` (or `string` — single-dep shorthand)

Job dependencies. Jobs listed here must complete first.

```yaml
needs: [job1, job2]   # canonical array form
needs: job1           # shorthand — exactly equivalent to needs: [job1]
```

#### if

**Type**: `string` (expression)

Conditional execution.

```yaml
if: ${{ success() }}
if: ${{ inputs.deploy == true }}
if: ${{ contains(needs.previous.outputs.errors, 'critical') }}
```

**Bare-`needs` shorthand**: writing `if: ${{ needs.draft }}` is rewritten at compile time to `if: ${{ needs.draft.outcome == 'ok' }}` — the common "run only if upstream succeeded" case without the boilerplate. Any compound expression (comparisons, boolean ops, payload reach-ins) is left exactly as authored.

```yaml
if: ${{ needs.draft }}             # shorthand for outcome == 'ok'
if: ${{ needs.draft.outcome == 'ok' }}   # canonical form (same result)
```

#### strategy

Parallelization strategy:

##### Static Matrix

```yaml
strategy:
  matrix:
    os: [ubuntu, windows, macos]
    version: [20, 21, 22]
    architecture: [x86_64, arm64]
  maxParallel: 6                     # Optional: limit concurrency
  include:                           # Optional: add extra combinations
    - os: ubuntu
      version: 23
```

Access via: `${{ matrix.os }}`, `${{ matrix.version }}`

##### Dynamic Matrix

```yaml
strategy:
  dynamic:
    from: ${{ needs.previous.outputs.items }}
    as: item
    maxEntries: 100                  # Prevent runaway expansion
```

Access via: `${{ dynamic.item }}`

#### uses

**Type**: `string`

Action reference in format: `namespace/action[@version]`

Examples:
- `xema/agent@2.1.0` — pinned to the current exact version (recommended for production)
- `xema/agent` — pins to the action's current version **at compile time** and freezes it into the run. The compiled run carries a concrete version, so replays remain deterministic; only a new compilation would pick up a newer current version.
- `xema/review@1.2.0`
- `xema/emit-artifact@1.0.0`
- `software-dev/create-repo@1.0.0`

Ranges (e.g. `@1.0`, `^1.0.0`) are intentionally **not supported** — they would let the same workflow compile to different versions on different days, breaking replay safety. Use exact versions or omit `@<ver>` entirely.

#### with

**Type**: `object`

Action inputs. Supports expressions.

```yaml
with:
  task: "Analyze requirements"
  org: ${{ vars.organization }}
  scope: ${{ inputs.project_scope }}
  previous_result: ${{ needs.analyze.outputs.summary }}
```

#### outputs

**Type**: `object`

Extract outputs from job result.

```yaml
outputs:
  summary: ${{ result.summary }}
  risks: ${{ result.risks }}
  artifact_id: ${{ result.artifact_id }}
```

Access downstream: `${{ needs.job_key.outputs.summary }}`

#### timeout

**Type**: `string` (duration)

Job-specific timeout. Overrides default.

```yaml
timeout: "30m"
```

#### retry

**Type**: `object`

Job-specific retry policy. Overrides default.

```yaml
retry:
  maxAttempts: 5
  backoffCoefficient: 1.5
```

---

## Expressions

Dynamic values in templates:

### Syntax

```
${{ <expression> }}
```

### Literals

```yaml
${{ 'string' }}
${{ 42 }}
${{ 3.14 }}
${{ true }}
${{ false }}
${{ null }}
```

### Variable References

```yaml
${{ inputs.project_name }}
${{ vars.organization }}
${{ needs.job1.outputs.summary }}
${{ matrix.os }}
${{ dynamic.service }}
${{ trigger.provider }}
```

### Operators

#### Comparison

```yaml
==, !=, <, >, <=, >=
```

#### Logical

```yaml
&&, ||, !
```

#### String

```yaml
+              # Concatenation
```

### Functions

#### Conditionals

```yaml
success()      # Previous job succeeded
failure()      # Previous job failed
always()       # Always true
```

#### String

```yaml
contains(str, substr)      # Check substring
startsWith(str, prefix)    # Check prefix
endsWith(str, suffix)      # Check suffix
```

#### Array

```yaml
length(arr)    # Array length
first(arr)     # First element
last(arr)      # Last element
```

#### Type Conversion

```yaml
toNumber(str)  # Convert to number
toString(val)  # Convert to string
toJSON(val)    # Convert to JSON
```

### Access Patterns

#### Object Property

```yaml
${{ obj.property }}
${{ obj['property-with-hyphen'] }}
```

#### Array Element

```yaml
${{ arr[0] }}           # First element
${{ arr[-1] }}          # Last element
${{ arr[*] }}           # All elements (for matrix)
```

### Context

| Context | Available In | Type |
|---------|---|---|
| `inputs` | All jobs | Input parameters |
| `vars` | All jobs | Workflow variables |
| `needs` | Dependent jobs | Previous job outputs |
| `matrix` | Matrix jobs | Current matrix value |
| `dynamic` | Dynamic jobs | Current dynamic value |
| `trigger` | All jobs | Webhook trigger data |
| `result` | In outputs | Current job result |

---

## Mounts (Advanced)

Optional: Mount external resources:

```yaml
mounts:
  - path: /artifacts
    source:
      kind: artifact-store-collection
      collectionId: coll_123
  - path: /code
    source:
      kind: scm-repo
      repoRef: github.com/acme/myrepo
      ref: main
  - path: /specs
    source:
      kind: deliverable-specs
      contractKey: enterprise-saas
```

---

**Version**: 1.0 — April 2026
