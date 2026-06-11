# Interactive Sessions: API Reference

> API Docs: https://agent-session-api.xema.dev/api/docs

Complete REST API documentation for interactive sessions.

**Base URL**: `https://agent-session-api.xema.dev`

**Authentication**: Bearer token required on all endpoints.

---

## Sessions

### Create Session

```
POST /sessions
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `profileKey` | string | Yes | Agent profile (e.g., `session`) |
| `title` | string | No | Human-readable session title |
| `modelId` | string | No | Override the default model |
| `repositoryId` | string | No | SCM repository to link |
| `branchStrategy` | string | No | `auto_create` \| `use_existing` \| `none` |
| `budgetLimit` | number | No | Max token budget |
| `customConfig` | object | No | Advanced agent config overrides |

**Example**:

```bash
curl -X POST https://agent-session-api.xema.dev/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profileKey": "session",
    "title": "Refactor auth module",
    "repositoryId": "repo-123",
    "branchStrategy": "auto_create",
    "budgetLimit": 200000
  }'
```

**Response** (`201`):

```json
{
  "id": "clxxxxxxxxxxxxxxxxxx",
  "orgId": "org-123",
  "projectId": "proj-456",
  "title": "Refactor auth module",
  "status": "creating",
  "profileKey": "session",
  "agentSlug": "engineering",
  "modelId": "anthropic/claude-sonnet-4-20250514",
  "tokenUsage": null,
  "budgetLimit": 200000,
  "branchName": null,
  "branchStrategy": "auto_create",
  "repositoryId": "repo-123",
  "pipelineRunId": null,
  "parentSessionId": null,
  "prUrl": null,
  "failureReason": null,
  "provisioningPhase": "queued",
  "createdAt": "2026-04-27T10:30:00Z",
  "lastActivityAt": "2026-04-27T10:30:00Z"
}
```

---

### Get Session

```
GET /sessions/{id}
```

**Response** (`200`): Session object (same structure as create response).

---

### List Sessions

```
GET /sessions
```

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `pipelineRunId` | string | Filter by pipeline run |
| `page` | number | Page number (default 1) |
| `limit` | number | Max results per page (default 20) |

**Example**:

```bash
curl "https://agent-session-api.xema.dev/sessions?status=active" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Pause Session

```
POST /sessions/{id}/pause
```

Session must be `active` with every thread idle (no turn in flight). Saves the workspace snapshot and releases the worker.

**Response** (`200`):

```json
{
  "paused": true
}
```

---

### Resume Session

```
POST /sessions/{id}/resume
```

Session must be `paused`. The row transitions to `recovering`, acquires a fresh worker, restores the saved state, then returns to `active`.

**Response** (`200`):

```json
{
  "resumed": true
}
```

---

### Fork Session

```
POST /sessions/{id}/fork
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Title for the forked session |

**Response** (`201`): New session object with `parentSessionId` set.

---

## Threads

A session hosts one or more **threads** — independent conversation streams that share the session's single worker and workspace. Every session is created with one default thread (`Main`); open more to run parallel conversations against the same files. Each thread has its own turn lock (`turnState`) and its own message history.

### List Threads

```
GET /sessions/{id}/threads
```

**Response** (`200`):

```json
{
  "data": [
    {
      "id": "thr_main",
      "sessionId": "cl123",
      "title": "Main",
      "status": "active",
      "turnState": "idle",
      "agentSlug": null,
      "createdAt": "2026-04-27T10:30:00Z",
      "lastActivityAt": "2026-04-27T10:34:12Z"
    }
  ]
}
```

### Create Thread

```
POST /sessions/{id}/threads
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Human-readable thread title (defaults to `New thread`) |
| `agentSlug` | string | No | Per-thread agent override (defaults to the session's agent) |

**Response** (`201`): Thread object.

### Update Thread

```
PATCH /sessions/{id}/threads/{threadId}
```

Rename a thread or change its lifecycle status.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | New title |
| `status` | string | No | `active` \| `archived` |

A session must always retain at least one `active` thread — archiving the last active thread is rejected with `409`.

### Delete Thread

```
DELETE /sessions/{id}/threads/{threadId}
```

Permanently deletes a thread and its messages. The session's last active thread cannot be deleted (`409`).

---

## Messages

### Send Message

```
POST /sessions/{id}/threads/{threadId}/messages
```

Returns a **streaming SSE response** (`text/event-stream`). The message is sent to a specific thread — use the session's default thread when you are not managing multiple conversations.

**Headers**:

| Header | Description |
|--------|-------------|
| `Idempotency-Key` | (Recommended) Unique key to prevent duplicate sends |

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | Message content (max 100KB) |

**Example**:

```bash
curl -X POST \
  https://agent-session-api.xema.dev/sessions/cl123/threads/thr_main/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"content": "Review the authentication module and suggest improvements."}'
```

**SSE Event Types**:

Every `data:` payload carries the `threadId` it belongs to, so a client multiplexing several threads over one connection can route each frame.

```
event: text_delta
data: {"delta": "Looking at the authentication module...", "sessionId": "cl123", "threadId": "thr_main"}

event: thinking
data: {"delta": "The user wants a code review..."}

event: tool_call
data: {"toolName": "read_file", "args": {"path": "src/auth/jwt.service.ts"}, "status": "started"}

event: file_change
data: {"operation": "edited", "path": "src/auth/jwt.service.ts", "diff": "..."}

event: todo_updated
data: {"todos": [{"id": "1", "content": "Review JWT logic", "done": true}, ...]}

event: question_asked
data: {"questionId": "q_abc", "question": "Should I use RS256 or HS256?"}

event: permission_asked
data: {"permissionId": "p_abc", "action": "delete", "resource": "src/legacy/old-auth.ts"}

event: done
data: {"messageId": "msg_xyz", "totalTokens": 8500}

event: error
data: {"code": "TOOL_FAILED", "message": "Could not read file"}
```

---

### List Messages

```
GET /sessions/{id}/threads/{threadId}/messages
```

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max messages (default 50) |
| `cursor` | string | Pagination cursor |

**Response** (`200`):

```json
{
  "data": [
    {
      "id": "msg_abc",
      "sessionId": "cl123",
      "threadId": "thr_main",
      "role": "user",
      "content": "Review the auth module",
      "createdAt": "2026-04-27T10:30:00Z"
    },
    {
      "id": "msg_def",
      "sessionId": "cl123",
      "threadId": "thr_main",
      "role": "assistant",
      "content": "I've reviewed the JWT authentication...",
      "metadata": {
        "tools": ["read_file", "list_directory"],
        "inputTokens": 3200,
        "outputTokens": 1800
      },
      "createdAt": "2026-04-27T10:30:45Z"
    }
  ],
  "nextCursor": null
}
```

---

## Questions & Permissions

### Answer a Question

```
POST /sessions/{id}/questions/{questionId}/answer
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `answer` | string | Yes | Your answer to the agent's question |

---

### Reject a Question

```
POST /sessions/{id}/questions/{questionId}/reject
```

The agent will proceed without an answer.

---

### Reply to Permission Request

```
POST /sessions/{id}/permissions/{permissionId}/reply
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `granted` | boolean | Yes | Whether to grant the permission |

---

## Events

### List Events

```
GET /sessions/{id}/events
```

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by event type |
| `afterSeq` | number | Get events after sequence number |
| `limit` | number | Max results |

**Response** (`200`):

```json
{
  "data": [
    {
      "id": "evt_abc",
      "sessionId": "cl123",
      "threadId": "thr_main",
      "seq": 1,
      "type": "status_changed",
      "payload": {"from": "creating", "to": "active"},
      "createdAt": "2026-04-27T10:30:01Z"
    },
    {
      "id": "evt_def",
      "sessionId": "cl123",
      "threadId": "thr_main",
      "seq": 2,
      "type": "file_created",
      "payload": {"path": "src/auth/token-rotation.service.ts"},
      "createdAt": "2026-04-27T10:31:00Z"
    }
  ]
}
```

---

## Git Operations

### Get Git Status

```
GET /sessions/{id}/git/status
```

**Response** (`200`):

```json
{
  "branch": "interactive/fix-auth-abc123",
  "status": "clean",
  "changes": [],
  "commits": [
    {"hash": "a1b2c3d", "message": "Add JWT token rotation", "author": "agent"}
  ],
  "pullRequest": {
    "url": "https://github.com/org/repo/pull/42",
    "number": 42,
    "title": "Refactor JWT authentication"
  }
}
```

---

### Create Branch

```
POST /sessions/{id}/git/branch
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `branchName` | string | Yes | Branch name to create |

---

### Commit Changes

```
POST /sessions/{id}/git/commit
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | Commit message |
| `files` | string[] | No | Specific files to commit (default: all staged) |

---

### Create Pull Request

```
POST /sessions/{id}/git/pull-requests
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | PR title |
| `description` | string | No | PR description |
| `baseBranch` | string | No | Target branch (default: `main`) |

---

### Check Merge Status

```
GET /sessions/{id}/git/merge-check?baseBranch=main
```

**Response** (`200`):

```json
{
  "canMerge": true,
  "conflicts": [],
  "checks": [
    {"name": "no-conflicts", "passed": true},
    {"name": "up-to-date", "passed": true}
  ]
}
```

---

## MCP Tool Selection

A session's MCP tools come from a single `toolSelection` list on the
session row. Each entry references a tool provider (or a specific tool
from a provider) — the platform's tool resolver expands the list into
the agent's `mcp` config at boot and on resume.

### Replace the session's tool selection

```
PATCH /sessions/{id}/tools
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `selection` | array | Yes | Ordered list of `ToolSelectionEntry`. Replaces the row atomically. |

Each `ToolSelectionEntry` is one of:

```jsonc
// All tools from a provider
{ "kind": "provider", "providerKind": "mcp_server", "resourceId": "<uuid>" }

// A single tool from a provider
{
  "kind": "tool",
  "providerKind": "biome_workflow_tools",
  "resourceId": "<installation-id>",
  "toolName": "search-archive"
}
```

Closed-set `providerKind` values: `mcp_server`, `catalog`,
`biome_workflow_tools`, `biome_code_tools`.

Each entry's `resourceId` is validated against the session's
`(orgId, projectId)` scope at PATCH time. Cross-org references are
rejected with `403`.

---

### Read the current tool selection

The current `toolSelection` is returned on `GET /sessions/{id}` as
`session.toolSelection: ToolSelectionEntry[]`.

The resolved set of MCP servers (after expansion through the tool
resolver) lands in the agent runtime's MCP config on the next boot or
resume.

---

## Skill Attachments

### Attach Skill

```
POST /sessions/{id}/skill-attachments
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skillSlug` | string | Yes | Slug of the skill to attach |

---

### List Skill Attachments

```
GET /sessions/{id}/skill-attachments
```

---

### Detach Skill

```
DELETE /sessions/{id}/skill-attachments/{attachmentId}
```

---

## File Attachments

### Add Attachment

```
POST /sessions/{id}/attachments
```

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kind` | string | Yes | `kb_page` \| `uploaded_file` \| `internal_url` \| `repo_ref` \| `org_document` |
| `externalRef` | string | Yes | Reference to the external resource |
| `metadata` | object | No | Display name, size, mime type, etc. |

---

### List Attachments

```
GET /sessions/{id}/attachments
```

---

### Remove Attachment

```
DELETE /sessions/{id}/attachments/{attachmentId}
```

---

## Preview Apps

### List Preview Apps

```
GET /sessions/{id}/preview-apps
```

**Response** (`200`):

```json
{
  "data": [
    {
      "id": "preview-123",
      "kind": "next_dev",
      "port": 3000,
      "status": "running",
      "url": "https://preview.xema.dev/s/abc123/3000",
      "startedAt": "2026-04-27T10:35:00Z"
    }
  ]
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SESSION_NOT_FOUND` | 404 | Session does not exist |
| `SESSION_NOT_ACTIVE` | 409 | Operation requires `active` status |
| `TURN_IN_PROGRESS` | 409 | Another message is being processed |
| `BUDGET_EXHAUSTED` | 422 | Token budget depleted |
| `PROVISIONING_FAILED` | 409 | Session failed during provisioning |
| `WORKER_UNAVAILABLE` | 503 | No workers available in pool |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |

---

**Previous**: [Features](./01-features.md)  
**Next**: [Pipeline Integration](./02-pipeline-integration.md)
