# API Reference

> API Docs: https://workflow-engine-api.xema.dev/api/docs

This document provides REST API endpoints for managing and triggering Xema Workflows.

## Table of Contents

1. [Authentication](#authentication)
2. [Base URL](#base-url)
3. [Common Response Format](#common-response-format)
4. [Workflow Management](#workflow-management)
5. [Workflow Execution](#workflow-execution)
6. [Artifact Management](#artifact-management)
7. [Template APIs](#template-apis)
8. [Error Handling](#error-handling)

---

## Authentication

All API requests require authentication:

```bash
curl -H "Authorization: Bearer $XEMA_TOKEN" https://workflow-engine-api.xema.dev/workflows/...
```

### Token Management

Generate API tokens in the dashboard:

```
Settings → API Tokens → Generate Token
```

### Rate Limiting

- **Free tier**: 100 requests/minute
- **Pro tier**: 1000 requests/minute
- **Enterprise**: Custom limits

Rate limit headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1234567890
```

---

## Base URL

```
https://workflow-engine-api.xema.dev
```

All endpoints are relative to this base URL.

---

## Common Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "resource_id",
    "name": "resource_name"
  },
  "metadata": {
    "timestamp": "2026-04-27T14:30:00Z",
    "version": "1.0"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "The provided input is invalid",
    "details": {
      "field": "inputs.project_name",
      "reason": "Required field missing"
    }
  }
}
```

### Pagination

List endpoints support pagination:

```bash
GET /workflows?page=1&limit=20
```

Response:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

---

## Workflow Management

### Get Workflow

Retrieve workflow details:

```
GET /workflows/{workflowId}
```

**Parameters**:
- `workflowId` (path, required) — Workflow ID

**Response**:
```json
{
  "data": {
    "id": "wf_abc123",
    "name": "my-workflow",
    "projectId": "proj_123",
    "version": "1.0.0",
    "status": "active",
    "createdAt": "2026-04-27T10:00:00Z",
    "updatedAt": "2026-04-27T14:30:00Z",
    "triggers": ["workflow_dispatch", "schedule"],
    "jobCount": 5
  }
}
```

### List Workflows

List all workflows in a project:

```
GET /projects/{projectId}/workflows
```

**Parameters**:
- `projectId` (path, required) — Project ID
- `page` (query, optional) — Page number (default: 1)
- `limit` (query, optional) — Items per page (default: 20)
- `status` (query, optional) — Filter by status (active, archived)

**Response**:
```json
{
  "data": [
    {
      "id": "wf_abc123",
      "name": "requirements-analysis",
      "version": "1.0.0",
      "status": "active",
      "triggers": ["workflow_dispatch"],
      "lastRun": "2026-04-27T14:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

### Create Workflow

Create a new workflow:

```
POST /projects/{projectId}/workflows
```

**Body**:
```json
{
  "name": "my-workflow",
  "description": "My first workflow",
  "content": "apiVersion: xema.dev/workflow/v1alpha1\nkind: Workflow\n..."
}
```

**Response**:
```json
{
  "data": {
    "id": "wf_abc123",
    "name": "my-workflow",
    "version": "1.0.0",
    "createdAt": "2026-04-27T14:30:00Z"
  }
}
```

### Update Workflow

Update an existing workflow:

```
PUT /workflows/{workflowId}
```

**Body**:
```json
{
  "description": "Updated description",
  "content": "apiVersion: xema.dev/workflow/v1alpha1\nkind: Workflow\n..."
}
```

**Response**:
```json
{
  "data": {
    "id": "wf_abc123",
    "version": "1.0.1",
    "updatedAt": "2026-04-27T14:35:00Z"
  }
}
```

### Delete Workflow

Delete a workflow:

```
DELETE /workflows/{workflowId}
```

**Response**:
```json
{
  "data": {
    "id": "wf_abc123",
    "deleted": true
  }
}
```

---

## Workflow Execution

### Dispatch Workflow

Trigger a workflow manually:

```
POST /workflows/{workflowId}/dispatch
```

**Body**:
```json
{
  "inputs": {
    "project_name": "Acme Portal",
    "scope": "full",
    "budget": 500000
  }
}
```

**Response**:
```json
{
  "data": {
    "runId": "run_abc123",
    "workflowId": "wf_abc123",
    "status": "pending",
    "createdAt": "2026-04-27T14:30:00Z"
  }
}
```

### Get Run Status

Get the status of a workflow run:

```
GET /workflows/runs/{runId}
```

**Response**:
```json
{
  "data": {
    "runId": "run_abc123",
    "workflowId": "wf_abc123",
    "status": "running",
    "progress": {
      "jobsCompleted": 2,
      "jobsTotal": 5,
      "percentComplete": 40
    },
    "jobs": [
      {
        "jobId": "job_1",
        "name": "analyze-requirements",
        "status": "completed",
        "startedAt": "2026-04-27T14:30:05Z",
        "completedAt": "2026-04-27T14:32:10Z",
        "duration": 125
      },
      {
        "jobId": "job_2",
        "name": "architecture-design",
        "status": "running",
        "startedAt": "2026-04-27T14:32:15Z"
      }
    ],
    "startedAt": "2026-04-27T14:30:00Z"
  }
}
```

### Get Job Output

Retrieve outputs from a completed job:

```
GET /workflows/runs/{runId}/jobs/{jobId}/outputs
```

**Response**:
```json
{
  "data": {
    "jobId": "job_1",
    "status": "completed",
    "outputs": {
      "summary": "Requirements analysis complete",
      "issues_found": 3,
      "recommendations": ["Add API docs", "Improve error handling"]
    }
  }
}
```

### Get Run Logs

Retrieve execution logs:

```
GET /workflows/runs/{runId}/logs
```

**Query Parameters**:
- `jobId` (optional) — Filter to specific job
- `level` (optional) — Log level (info, warning, error)
- `limit` (optional) — Max log lines (default: 100)

**Response**:
```json
{
  "data": {
    "logs": [
      {
        "timestamp": "2026-04-27T14:30:05Z",
        "jobId": "job_1",
        "level": "info",
        "message": "Starting job: analyze-requirements"
      },
      {
        "timestamp": "2026-04-27T14:30:10Z",
        "jobId": "job_1",
        "level": "info",
        "message": "Processing 12 requirements..."
      }
    ]
  }
}
```

### List Runs

List all runs for a workflow:

```
GET /workflows/{workflowId}/runs
```

**Query Parameters**:
- `status` (optional) — Filter by status (pending, running, succeeded, failed)
- `page` (optional) — Page number
- `limit` (optional) — Items per page

**Response**:
```json
{
  "data": [
    {
      "runId": "run_abc123",
      "status": "succeeded",
      "createdAt": "2026-04-27T14:30:00Z",
      "completedAt": "2026-04-27T14:45:00Z",
      "duration": 900
    }
  ],
  "pagination": { ... }
}
```

### Cancel Run

Cancel a running workflow:

```
POST /workflows/runs/{runId}/cancel
```

**Response**:
```json
{
  "data": {
    "runId": "run_abc123",
    "status": "cancelled",
    "cancelledAt": "2026-04-27T14:35:00Z"
  }
}
```

### Retry Run

Retry a failed workflow:

```
POST /workflows/runs/{runId}/retry
```

**Body** (optional):
```json
{
  "inputs": {
    "retry_strategy": "exponential"
  }
}
```

**Response**:
```json
{
  "data": {
    "newRunId": "run_def456",
    "originalRunId": "run_abc123",
    "status": "pending"
  }
}
```

---

## Artifact Management

### List Artifacts

List all artifacts from a run:

```
GET /workflows/runs/{runId}/artifacts
```

**Query Parameters**:
- `type` (optional) — Filter by artifact type
- `page` (optional) — Page number

**Response**:
```json
{
  "data": [
    {
      "id": "art_abc123",
      "type": "requirements_spec",
      "version": 1,
      "hash": "sha256:abc123...",
      "size": 45632,
      "createdAt": "2026-04-27T14:35:00Z",
      "metadata": {
        "phase": "requirements",
        "project_id": "proj_123"
      }
    }
  ]
}
```

### Get Artifact

Retrieve artifact details:

```
GET /artifacts/{artifactId}
```

**Response**:
```json
{
  "data": {
    "id": "art_abc123",
    "type": "requirements_spec",
    "version": 1,
    "pointer": "s3://artifacts/art_abc123/v1",
    "hash": "sha256:abc123...",
    "size": 45632,
    "createdAt": "2026-04-27T14:35:00Z",
    "content": "# Requirements Specification\n..."
  }
}
```

### Download Artifact

Download artifact content:

```
GET /artifacts/{artifactId}/download
```

Returns the artifact file (binary).

### Get Artifact History

Get all versions of an artifact:

```
GET /artifacts/{artifactId}/versions
```

**Response**:
```json
{
  "data": [
    {
      "version": 2,
      "hash": "sha256:def456...",
      "createdAt": "2026-04-27T14:40:00Z"
    },
    {
      "version": 1,
      "hash": "sha256:abc123...",
      "createdAt": "2026-04-27T14:35:00Z"
    }
  ]
}
```

---

## Template APIs

### List Templates

Get all available templates:

```
GET /templates
```

**Query Parameters**:
- `type` (optional) — Filter by type (prompt, deliverable, session)
- `complexity` (optional) — Filter by complexity (simple, complex, enterprise)
- `search` (optional) — Search by name

**Response**:
```json
{
  "data": [
    {
      "key": "requirements-enterprise",
      "name": "Enterprise Requirements Spec",
      "type": "deliverable",
      "complexity": "enterprise",
      "description": "Comprehensive requirements for enterprise projects"
    }
  ]
}
```

### Get Template

Retrieve template details:

```
GET /templates/{templateKey}
```

**Response**:
```json
{
  "data": {
    "key": "requirements-enterprise",
    "name": "Enterprise Requirements Spec",
    "type": "deliverable",
    "version": "2.1.0",
    "complexity": "enterprise",
    "content": "# {{projectName}} Requirements...",
    "requiredFields": ["projectName", "functionalRequirements"],
    "optionalFields": ["budget", "timeline"]
  }
}
```

### Render Template

Render a template with context:

```
POST /templates/{templateKey}/render
```

**Body**:
```json
{
  "context": {
    "projectName": "Acme Portal",
    "functionalRequirements": [
      {
        "id": "FR-1",
        "title": "User Authentication",
        "priority": "high"
      }
    ],
    "budget": 500000,
    "timeline": "6 months"
  }
}
```

**Response**:
```json
{
  "data": {
    "rendered": "# Acme Portal Requirements Specification\n\n## Functional Requirements\n...",
    "warnings": []
  }
}
```

---

## Error Handling

### Common Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `INVALID_INPUT` | 400 | Input validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Input validation failed",
    "details": {
      "field": "inputs.budget",
      "reason": "Must be a positive number",
      "value": -1000
    }
  }
}
```

### Retry Strategy

Implement exponential backoff for retries:

```
Wait time = 2^attempt (capped at 60 seconds)
Attempt 1: 2 seconds
Attempt 2: 4 seconds
Attempt 3: 8 seconds
...
```

---

## Examples

### Example 1: Dispatch and Monitor Workflow

```bash
#!/bin/bash

# Dispatch workflow
RESPONSE=$(curl -s -X POST https://workflow-engine-api.xema.dev/workflows/wf_abc123/dispatch \
  -H "Authorization: Bearer $XEMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "project_name": "Acme Portal",
      "scope": "full"
    }
  }')

RUN_ID=$(echo $RESPONSE | jq -r '.data.runId')
echo "Workflow started: $RUN_ID"

# Poll for completion
while true; do
  STATUS=$(curl -s https://workflow-engine-api.xema.dev/runs/$RUN_ID \
    -H "Authorization: Bearer $XEMA_TOKEN" | jq -r '.data.status')
  
  if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ]; then
    echo "Workflow $STATUS"
    break
  fi
  
  echo "Status: $STATUS"
  sleep 10
done

# Get artifacts
curl -s https://workflow-engine-api.xema.dev/runs/$RUN_ID/artifacts \
  -H "Authorization: Bearer $XEMA_TOKEN" | jq '.data'
```

### Example 2: Template Rendering

```bash
# Render a template
curl -X POST https://deliverable-specs-api.xema.dev/deliverable-specs/requirements-enterprise/render \
  -H "Authorization: Bearer $XEMA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "context": {
      "projectName": "Acme Portal",
      "functionalRequirements": [
        {
          "id": "FR-1",
          "title": "User Authentication",
          "priority": "high"
        }
      ]
    }
  }' | jq '.data.rendered'
```

---

**Last Updated**: April 2026  
**API Version**: 1.0
