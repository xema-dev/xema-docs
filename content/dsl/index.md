# Xema Workflow DSL

> API Docs: https://workflow-engine-api.xema.dev/api/docs

Complete specification for the Xema Workflow Domain-Specific Language (DSL).

## What is the DSL?

The Xema Workflow DSL is a **YAML-based declarative language** for defining automated software delivery processes. It enables:

- **Non-programmers** to define complex workflows
- **Version control** through YAML files
- **Type-safe validation** at compile time
- **Reproducible execution** with deterministic hashing

## Quick Start

Create a file `workflow.yaml`:

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: my-first-workflow
  version: 1.0.0

on:
  workflow_dispatch:
    inputs:
      project_name:
        type: string
        required: true

jobs:
  hello:
    uses: xema/agent
    with:
      task: "Say hello to ${{ inputs.project_name }}"
```

## Table of Contents

- [Language Reference](./01-reference.md) — Complete syntax guide
- [Examples](./examples/index.md) — Common workflow patterns
- [Best Practices](./02-best-practices.md) — Tips and conventions
- [Troubleshooting](./03-troubleshooting.md) — Debug workflow issues
- [Decision Gate](./04-decision-gate.md) — `xema/decision-gate` reference (humans / agents / endpoints, M-of-N policy)
- [Review](./05-review.md) — `xema/review` reference (subject + reviewers, optional redraft loop, terminal reviews, approval gates)
- [Agent Step](./06-agent-step.md) — `xema/agent` reference (model override, sub-agent bindings, workspace manifest, inputs)
- [Dispatch Workflow](./07-dispatch-workflow.md) — `xema/dispatch-workflow` reference (start another run; fire-and-forget vs await-completion modes)
- [Back to Workflows](../workflows/index.md) — Main workflows documentation

## Core Concepts

### Structure

Every workflow has this basic structure:

```
apiVersion:    Specifies v1alpha1
kind:          Always "Workflow"
metadata:      Name, version, description
on:            Trigger definitions
concurrency:   Concurrency control
defaults:      Default settings
permissions:   Resource access
vars:          Static variables
jobs:          Workflow jobs
```

### Triggers

Define when workflows execute:

- `workflow_dispatch` — Manual trigger with inputs
- `schedule` — Cron-based scheduling
- `webhook` — External event (GitHub, Jira, etc.)
- `workflow_call` — Called by other workflows

### Jobs

Jobs are units of work:

- Run in parallel (default) or sequential (with `needs`)
- Execute actions like agents, reviews, webhooks
- Produce outputs for downstream jobs
- Support conditional execution (`if`)
- Support parallelization (`strategy.matrix`)

### Data Flow

```
Inputs → Variables → Jobs → Outputs → Downstream Jobs
         ↓
      Expressions (dynamic values)
```

## Key Features

### 1. Deterministic Execution

```
Same (workflow version + inputs) = Same execution
```

Enables:
- Reproducibility
- Auditability
- Replay ability

### 2. Type Safety

All inputs, outputs, and parameters are typed:

```yaml
inputs:
  budget:
    type: number           # Enforced type
    required: true         # Must be provided
    defaultValue: 100000   # Fallback
```

### 3. Expressions

Dynamic values using template syntax:

```yaml
${{ inputs.project_name }}
${{ vars.organization }}
${{ needs.previous.outputs.summary }}
```

### 4. Matrix Expansion

Run jobs multiple times with different inputs:

```yaml
strategy:
  matrix:
    version: [20, 21, 22]
```

### 5. Conditional Execution

```yaml
if: ${{ inputs.deploy == true && success() }}
```

## Validation

The DSL is validated at:

1. **Parse time** — YAML syntax
2. **Compile time** — Schema validation, action refs, types
3. **Runtime** — Inputs, permissions, resources

Invalid workflows are **rejected with clear errors**. No silent failures.

## Next Steps

1. **[Language Reference](./01-reference.md)** — Learn complete syntax
2. **[Examples](./examples/index.md)** — See real-world patterns
3. **[Best Practices](./02-best-practices.md)** — Follow conventions

## FAQ

**Q: Can I use variables in trigger inputs?**  
A: No. Trigger inputs must be static. Use workflow variables for dynamic content.

**Q: How long can a workflow run?**  
A: Months or years. The Xema Workflow Runtime supports long-running workflows.

**Q: Can I call external APIs?**  
A: Yes, use `xema/http` or `xema/webhook` actions.

**Q: How do I handle errors?**  
A: Use retry policies and conditional execution (`if: ${{ failure() }}`).

---

**Version**: 1.0 — April 2026
