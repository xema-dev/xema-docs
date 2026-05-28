# Troubleshooting

> API Docs: https://workflow-engine-api.xema.dev/api/docs

Debugging guide for common workflow issues.

## Table of Contents

1. [Workflow Won't Start](#workflow-wont-start)
2. [Compilation Errors](#compilation-errors)
3. [Job Failures](#job-failures)
4. [Expression Errors](#expression-errors)
5. [Data Flow Issues](#data-flow-issues)
6. [Permission Issues](#permission-issues)
7. [Performance Issues](#performance-issues)
8. [Getting Help](#getting-help)

---

## Workflow Won't Start

### Issue: Workflow Dispatch Fails

**Error**: `Invalid input: budget must be a number`

**Diagnosis**:
- Input validation failed during dispatch
- User provided wrong type

**Solution**:
```bash
# Check workflow input schema
curl https://workflow-engine-api.xema.dev/workflows/wf_123 \
  -H "Authorization: Bearer $TOKEN" | jq '.data.triggers'

# Correct the dispatch call
curl -X POST https://workflow-engine-api.xema.dev/workflows/wf_123/dispatch \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "inputs": {
      "budget": 100000      # Number, not string
    }
  }'
```

**Prevention**:
- Define input types explicitly
- Use enums for closed sets
- Test dispatch before deploying

---

## Compilation Errors

### Issue: Unknown Action

**Error**: `Action xema/unknown not found`

**Diagnosis**:
- Action reference typo
- Action doesn't exist
- Version uses an unsupported range form

**Solution**:
```yaml
# ✅ Correct — omit the version to pin the current one at compile time
uses: xema/agent

# ✅ Correct — or pin an exact version
uses: xema/agent@1.0.0

# ❌ Range — `@1.0` is a range, not an exact version; not supported
uses: xema/agent@1.0

# ❌ Wrong action — this action does not exist
uses: xema/undefined
```

A `uses:` reference is `namespace/action` with an optional exact `@MAJOR.MINOR.PATCH` version. Omit `@<version>` to pin the action's current version at compile time. Ranges (`@1.0`, `^1.0.0`) are not supported — see the [Language Reference](./01-reference.md#uses).

**Available Actions**:
- `xema/agent` — LLM agent
- `xema/review` — Draft + review loop
- `xema/emit-artifact` — Save artifact
- `xema/decision-gate` — Approval gate
- `xema/webhook` — Send webhook
- `xema/http` — HTTP request

### Issue: Circular Dependencies

**Error**: `Circular dependency detected: job1 → job2 → job1`

**Diagnosis**:
- Jobs reference each other in `needs`

**Solution**:
```yaml
❌ Bad:
jobs:
  job1:
    needs: [job2]

  job2:
    needs: [job1]        # Circular!

✅ Fix:
jobs:
  job1:
    uses: xema/agent

  job2:
    needs: [job1]        # Linear dependency
```

### Issue: Missing Required Input

**Error**: `Missing required input: project_name`

**Diagnosis**:
- Workflow definition requires input but dispatch didn't provide it

**Solution**:
```yaml
# In workflow.yaml
on:
  workflow_dispatch:
    inputs:
      project_name:
        type: string
        required: true
```

```bash
# In dispatch
curl -X POST https://workflow-engine-api.xema.dev/workflows/wf_123/dispatch \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "inputs": {
      "project_name": "Acme"        # Provide required input
    }
  }'
```

---

## Job Failures

### Issue: Job Timed Out

**Error**: `Job 'analyze' exceeded timeout of 1h`

**Diagnosis**:
- Job is taking longer than timeout
- External service is slow

**Solution**:
```yaml
# Increase timeout
jobs:
  slow-task:
    timeout: "4h"        # Was 1h
    uses: xema/agent
```

Or:
```yaml
# Increase default timeout
defaults:
  timeout: "4h"
```

**Debug**:
```bash
# Check job logs
curl https://workflow-engine-api.xema.dev/runs/run_123/logs \
  ?jobId=slow-task \
  -H "Authorization: Bearer $TOKEN" | jq '.data.logs[]'
```

### Issue: Job Failed After Retries

**Error**: `Job 'deploy' failed after 3 retries`

**Diagnosis**:
- Job repeatedly failed
- Retry policy exhausted

**Solution**:
```yaml
# Increase retry attempts
jobs:
  deploy:
    retry:
      maxAttempts: 5     # Was 3
    uses: xema/agent
```

Or implement fallback:
```yaml
jobs:
  primary-deploy:
    uses: xema/agent

  fallback-deploy:
    if: ${{ failure() }}
    uses: xema/agent
    with:
      strategy: fallback
```

**Debug**:
```bash
# Get retry details
curl https://workflow-engine-api.xema.dev/runs/run_123 \
  -H "Authorization: Bearer $TOKEN" | jq '.data.jobs[] | select(.name=="deploy")'
```

---

## Expression Errors

### Issue: Expression Syntax Error

**Error**: `Invalid expression: ${{ inputs.name.toUpperCase() }}`

**Diagnosis**:
- Expression contains invalid syntax
- Function doesn't exist

**Solution**:
```yaml
✅ Valid:
${{ inputs.name }}
${{ contains(inputs.name, 'test') }}
${{ inputs.budget > 100000 }}

❌ Invalid:
${{ inputs.name.toUpperCase() }}  # Method calls not supported
${{ inputs.name | uppercase }}     # Pipe not supported
${{ inputs.name.. }}               # Syntax error
```

### Issue: Undefined Variable

**Error**: `Variable 'projects' not found in context`

**Diagnosis**:
- Referenced variable doesn't exist
- Typo in variable name

**Solution**:
```yaml
✅ Correct:
${{ vars.organization }}
${{ inputs.budget }}
${{ needs.job1.outputs.summary }}

❌ Wrong:
${{ vars.org }}           # Should be 'organization'
${{ inputs.budge }}       # Should be 'budget'
${{ needs.job1.output }}  # Should be 'outputs'
```

### Issue: Type Mismatch

**Error**: `Cannot compare string with number: 'high' >= 100`

**Diagnosis**:
- Expression compares incompatible types

**Solution**:
```yaml
✅ Correct types:
${{ inputs.budget >= 100000 }}          # Both numbers
${{ inputs.priority == 'high' }}        # Both strings

❌ Type mismatch:
${{ inputs.priority >= 100 }}           # String vs number
${{ inputs.budget == 'large' }}         # Number vs string
```

---

## Data Flow Issues

### Issue: Output Not Available

**Error**: `Output 'summary' not found in job 'analyze'`

**Diagnosis**:
- Job doesn't declare output
- Output name typo
- Accessing from non-dependent job

**Solution**:
```yaml
# Declare output
jobs:
  analyze:
    uses: xema/agent
    outputs:
      summary: ${{ result.summary }}    # Declare it

  process:
    needs: analyze
    with:
      summary: ${{ needs.analyze.outputs.summary }}  # Then use it
```

### Issue: Matrix Outputs Not Expanding

**Error**: `Cannot expand matrix output: needs.test.outputs is not array`

**Diagnosis**:
- Matrix job didn't produce outputs
- Incorrect output syntax

**Solution**:
```yaml
jobs:
  test-all:
    strategy:
      matrix:
        version: [20, 21, 22]
    uses: xema/agent
    outputs:
      result: ${{ result.output }}      # Declare output

  report:
    needs: test-all
    with:
      # Correct: Access all outputs
      results: ${{ needs.test-all.outputs[*] }}
      
      # ❌ Wrong:
      # results: ${{ needs.test-all.output }}    # Missing 's'
```

### Issue: Webhook Payload Missing

**Error**: `trigger.payload is null`

**Diagnosis**:
- Workflow not triggered by webhook
- Accessing non-webhook context

**Solution**:
```yaml
# Only available in webhook triggers
on:
  webhook:
    - event: scm.push

jobs:
  process:
    uses: xema/agent
    with:
      # ✅ Available here
      provider: ${{ trigger.provider }}
      
      # ❌ Not available if triggered manually
```

Or check trigger type:
```yaml
if: ${{ trigger.provider != null }}     # Only if webhook
```

---

## Permission Issues

### Issue: Permission Denied

**Error**: `Insufficient permissions: 'write' permission required for 'backlog'`

**Diagnosis**:
- Workflow doesn't have required permission
- Attempting operation beyond declared scope

**Solution**:
```yaml
# Add permission
permissions:
  backlog: write          # Was: read

jobs:
  update-issue:
    uses: xema/http
    with:
      url: https://jira.acme.com/...
      method: PUT
```

**Available Scopes**:
- `repos` — SCM access (read, limited, write)
- `kb` — Knowledge base (read, limited, write)
- `backlog` — Issue tracking (read, limited, write)
- `artifacts` — Artifact store (read, limited, write)
- `integrations` — External integrations (read, limited, write)

---

## Performance Issues

### Issue: Workflow Too Slow

**Error**: `Workflow took 8 hours to complete (expected < 2 hours)`

**Diagnosis**:
- Sequential jobs that could be parallel
- Large matrix expansion
- Network timeouts

**Solution - Parallelize**:
```yaml
❌ Sequential:
jobs:
  build-backend:
    uses: xema/agent

  build-frontend:
    needs: build-backend     # Unnecessary dependency
    uses: xema/agent

✅ Parallel:
jobs:
  build-backend:
    uses: xema/agent

  build-frontend:
    uses: xema/agent      # No dependency

  test-integration:
    needs: [build-backend, build-frontend]
    uses: xema/agent
```

**Solution - Limit Matrix**:
```yaml
✅ Safe expansion:
strategy:
  dynamic:
    from: ${{ needs.discover.outputs.services }}
    maxEntries: 50          # Cap it!

❌ Runaway:
strategy:
  dynamic:
    from: ${{ needs.discover.outputs.services }}
    # Could create 1000+ jobs!
```

### Issue: Too Many Concurrent Jobs

**Error**: `Queue full: Too many jobs scheduled (max: 100)`

**Diagnosis**:
- Matrix explosion
- Need to limit parallelism

**Solution**:
```yaml
strategy:
  matrix:
    version: [18, 19, 20, 21, 22]
  maxParallel: 2            # Limit to 2 at a time
```

---

## Getting Help

### Check Workflow Status

```bash
# Get workflow details
curl https://workflow-engine-api.xema.dev/workflows/wf_123 \
  -H "Authorization: Bearer $TOKEN" | jq

# List recent runs
curl https://workflow-engine-api.xema.dev/workflows/wf_123/runs \
  -H "Authorization: Bearer $TOKEN" | jq '.data[]'

# Get specific run
curl https://workflow-engine-api.xema.dev/runs/run_123 \
  -H "Authorization: Bearer $TOKEN" | jq

# Get run logs
curl https://workflow-engine-api.xema.dev/runs/run_123/logs \
  -H "Authorization: Bearer $TOKEN" | jq '.data.logs'
```

### Debug Expressions

```bash
# Test expression rendering
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs/test-render \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "expression": "${{ inputs.name }}",
    "context": {
      "inputs": { "name": "Test" }
    }
  }'
```

### Validate YAML

```bash
# Local validation
yamllint workflow.yaml

# Validate against schema
ajv validate -s workflow.schema.json -d workflow.yaml
```

### Common Issues Checklist

- [ ] Input types match dispatch values
- [ ] Required inputs are provided
- [ ] Action names are correct
- [ ] No circular job dependencies
- [ ] Job dependencies use `needs`
- [ ] Outputs are declared before use
- [ ] Expressions have correct syntax
- [ ] Variables exist in scope
- [ ] Permissions cover required access
- [ ] Timeouts are reasonable
- [ ] Retry policies are defined
- [ ] Error handling (if, always, etc.)

---

**Next**: [Decision Gate →](./04-decision-gate.md) — `xema/decision-gate` reference.
