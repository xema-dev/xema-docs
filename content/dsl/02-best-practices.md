# Best Practices

> API Docs: https://workflow-engine-api.xema.dev/api/docs

Guidelines and conventions for writing high-quality workflows.

## Table of Contents

1. [Naming Conventions](#naming-conventions)
2. [Structure & Organization](#structure--organization)
3. [Type Safety](#type-safety)
4. [Error Handling](#error-handling)
5. [Performance](#performance)
6. [Security](#security)
7. [Maintainability](#maintainability)
8. [Testing](#testing)

---

## Naming Conventions

### Workflow Names

Use **lowercase, hyphenated**, descriptive names:

✅ Good:
```yaml
name: requirements-analysis
name: github-pr-review
name: weekly-report-generator
```

❌ Bad:
```yaml
name: ReqAnalysis
name: pr_review
name: report1
```

### Job Names

Use **lowercase, hyphenated**, action-oriented names:

✅ Good:
```yaml
jobs:
  analyze-requirements:
  create-specification:
  notify-stakeholders:
```

❌ Bad:
```yaml
jobs:
  job1:
  doStuff:
  req:
```

### Variable Names

Use **lowercase, underscored** descriptive names:

✅ Good:
```yaml
vars:
  max_concurrent_jobs: 5
  organization_name: "Acme"
  default_timeout_minutes: 60
```

❌ Bad:
```yaml
vars:
  MAX_JOBS: 5
  org: "Acme"
  timeout: 60
```

---

## Structure & Organization

### Keep Workflows Focused

Each workflow should have **a single responsibility**:

✅ Good:
```yaml
# Single responsibility: Analyze requirements
name: analyze-requirements
jobs:
  analyze:
    ...
  create-spec:
    ...
```

❌ Bad:
```yaml
# Multiple responsibilities mixed
name: full-pipeline
jobs:
  analyze:
    ...
  build:
    ...
  test:
    ...
  deploy:
    ...
```

### Order Jobs Logically

Place related jobs together:

```yaml
jobs:
  # Input processing
  validate-input:
    ...

  # Analysis phase
  analyze:
    ...
  review-analysis:
    ...

  # Output generation
  create-deliverable:
    ...

  # Notification
  notify-complete:
    ...
```

### Use Descriptive Titles

Add `title` field for clarity:

✅ Good:
```yaml
jobs:
  analyze-requirements:
    title: Analyze Project Requirements
    uses: xema/agent
```

❌ Bad:
```yaml
jobs:
  analyze-requirements:
    uses: xema/agent
```

---

## Type Safety

### Always Type Inputs

Specify types explicitly:

✅ Good:
```yaml
on:
  workflow_dispatch:
    inputs:
      budget:
        type: number
        required: true
      include_testing:
        type: boolean
        required: false
        defaultValue: true
      priority:
        type: string
        enum: [low, medium, high]
        required: true
```

❌ Bad:
```yaml
on:
  workflow_dispatch:
    inputs:
      budget:           # Type not specified
      include_testing:  # Required missing
      priority: null
```

### Use Enums for Closed Sets

Don't accept arbitrary strings for known values:

✅ Good:
```yaml
inputs:
  environment:
    type: string
    enum: [dev, staging, production]
    required: true
```

❌ Bad:
```yaml
inputs:
  environment:
    type: string
    required: true  # Accepts ANY string
```

### Declare Outputs

Always extract outputs explicitly:

✅ Good:
```yaml
jobs:
  analyze:
    uses: xema/agent
    with: { task: Analyze }
    outputs:
      summary: ${{ result.summary }}
      issues: ${{ result.issues }}
```

❌ Bad:
```yaml
jobs:
  analyze:
    uses: xema/agent
    with: { task: Analyze }
    # Outputs not declared
```

---

## Error Handling

### Define Retry Policies

Set clear retry expectations:

✅ Good:
```yaml
defaults:
  retry:
    maxAttempts: 3
    backoffCoefficient: 2.0
    initialInterval: 1s

jobs:
  external-call:
    retry:
      maxAttempts: 5  # Override for flaky service
```

❌ Bad:
```yaml
# No retry policy defined
```

### Handle Failures Explicitly

Don't let failures silently stop workflows:

✅ Good:
```yaml
jobs:
  primary:
    uses: xema/agent
    with: { task: Primary }

  fallback:
    if: ${{ failure() }}
    uses: xema/agent
    with: { task: Fallback }

  notify:
    if: ${{ always() }}  # Always run
    uses: xema/webhook
```

❌ Bad:
```yaml
jobs:
  primary:
    uses: xema/agent
  # No fallback or notification
```

### Set Timeouts

Prevent workflows from hanging:

✅ Good:
```yaml
defaults:
  timeout: "24h"

jobs:
  approval:
    timeout: "7 days"
    uses: xema/decision-gate
```

❌ Bad:
```yaml
# No timeout defined
# Workflow could hang indefinitely
```

---

## Performance

### Parallelize When Possible

Use matrix for parallel execution:

✅ Good:
```yaml
jobs:
  test-all:
    strategy:
      matrix:
        version: [20, 21, 22]
      maxParallel: 4
    uses: xema/agent
```

❌ Bad:
```yaml
jobs:
  test-20:
    uses: xema/agent
  test-21:
    needs: test-20        # Sequential!
    uses: xema/agent
```

### Avoid Sequential Dependencies

When not needed:

✅ Good:
```yaml
jobs:
  build-backend:
    uses: xema/agent

  build-frontend:
    uses: xema/agent  # No dependency

  test-integration:
    needs: [build-backend, build-frontend]
    uses: xema/agent
```

❌ Bad:
```yaml
jobs:
  build-backend:
    uses: xema/agent

  build-frontend:
    needs: build-backend   # Unnecessary!
    uses: xema/agent
```

### Limit Matrix Expansion

Prevent runaway jobs:

✅ Good:
```yaml
strategy:
  dynamic:
    from: ${{ needs.discover.outputs.services }}
    as: service
    maxEntries: 50        # Safe limit
```

❌ Bad:
```yaml
strategy:
  dynamic:
    from: ${{ needs.discover.outputs.services }}
    as: service
    # Could explode to 1000+ jobs!
```

---

## Security

### Protect Secrets

Never hardcode secrets:

✅ Good:
```yaml
with:
  api_key: ${{ secrets.API_KEY }}
  password: ${{ secrets.DB_PASSWORD }}
```

❌ Bad:
```yaml
with:
  api_key: "sk-1234567890abcdef"  # Exposed!
```

### Declare Permissions

Be explicit about resource access:

✅ Good:
```yaml
permissions:
  repos: read
  kb: limited
  backlog: write
  artifacts: read
```

❌ Bad:
```yaml
# No permissions declared
# Defaults to maximum?
```

### Validate Webhook Filters

Don't trust all webhooks:

✅ Good:
```yaml
on:
  webhook:
    - event: scm.push
      filters:
        projectId: proj_123
        branch: main
```

❌ Bad:
```yaml
on:
  webhook:
    - event: scm.push
    # Triggers on ALL pushes to ALL projects!
```

---

## Maintainability

### Document Complex Workflows

Add descriptions and titles:

✅ Good:
```yaml
metadata:
  name: requirements-analysis
  version: 1.0.0
  description: |
    Analyzes project requirements, routes through technical and PM review,
    and generates specification document. Supports simple/standard/enterprise
    scope levels.

vars:
  max_scope: enterprise           # Comment on non-obvious values
```

### Use Variables for Reusable Values

Don't repeat magic strings:

✅ Good:
```yaml
vars:
  organization: "Acme Corp"
  max_retries: 3
  notification_url: "https://alerts.acme.com"

jobs:
  analyze:
    with:
      org: ${{ vars.organization }}
  notify:
    with:
      url: ${{ vars.notification_url }}
```

❌ Bad:
```yaml
jobs:
  analyze:
    with:
      org: "Acme Corp"
  job2:
    with:
      org: "Acme Corp"  # Repeated!
  notify:
    with:
      url: "https://alerts.acme.com"
```

### Keep Jobs Small

One responsibility per job:

✅ Good:
```yaml
jobs:
  analyze:
    uses: xema/agent
    with: { task: Analyze }

  review:
    needs: analyze
    uses: xema/decision-gate

  publish:
    needs: review
    uses: xema/emit-artifact
```

❌ Bad:
```yaml
jobs:
  do-everything:
    # Analyze + review + publish in one job
    # Hard to debug, reuse, test
```

### Version Everything

Track changes with semantic versioning:

✅ Good:
```yaml
metadata:
  name: my-workflow
  version: 1.2.3      # MAJOR.MINOR.PATCH
```

Changes:
- 1.2.3 → 1.2.4 — Bug fix
- 1.2.3 → 1.3.0 — New feature
- 1.2.3 → 2.0.0 — Breaking change

---

## Testing

### Test with Mock Data

Before deploying:

```bash
# Trigger workflow with test inputs
curl -X POST https://workflow-engine-api.xema.dev/workflows/wf_123/dispatch \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "inputs": {
      "project_name": "Test Project",
      "scope": "simple"
    }
  }'
```

### Monitor Executions

Watch for issues:

```bash
# Check workflow runs
curl https://workflow-engine-api.xema.dev/workflows/wf_123/runs \
  -H "Authorization: Bearer $TOKEN" | jq '.data[] | {runId, status}'
```

### Validate YAML

Check syntax before deploying:

```bash
# Validate against schema
yamllint workflow.yaml
```

---

## Summary

✅ **Do**:
- Use descriptive, consistent names
- Type all inputs with enums
- Declare outputs explicitly
- Handle errors gracefully
- Set timeouts
- Use variables for reusable values
- Parallelize when possible
- Protect secrets
- Document complex workflows
- Version workflows semantically

❌ **Don't**:
- Use generic names (job1, task)
- Accept arbitrary string inputs
- Leave workflows without error handling
- Let workflows hang indefinitely
- Hardcode configuration values
- Create sequential dependencies unnecessarily
- Expose secrets in code
- Document nothing
- Change workflows without versioning

---

**Next**: Read [Troubleshooting](./03-troubleshooting.md) for debugging help.
