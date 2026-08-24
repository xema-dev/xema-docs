# Interactive Sessions: Features

> API Docs: https://agent-session-api.xema.dev/api/docs

Complete feature reference for interactive sessions.

## Table of Contents

1. [Session Creation & Configuration](#session-creation--configuration)
2. [Provisioning & Worker Assignment](#provisioning--worker-assignment)
3. [Conversation Threads](#conversation-threads)
4. [Real-Time Conversation](#real-time-conversation)
5. [File & Code Operations](#file--code-operations)
6. [Git & Version Control](#git--version-control)
7. [Pause & Resume](#pause--resume)
8. [Attachments & Extensions](#attachments--extensions)
9. [Preview Apps](#preview-apps)
10. [Budget & Limits](#budget--limits)
11. [Pipeline Integration](#pipeline-integration)
12. [Session Forking](#session-forking)
13. [Audit & History](#audit--history)

---

## Session Creation & Configuration

### Agent reference

Every generic session names a published Agent with `agentRef`, as a bare slug or a version pin such as `engineering-assistant@3`. The resolved Agent is the source of truth for its prompt, recursive subagents, intrinsic Skills and Tools, capability envelope, workspace configuration, and launch policy.

When `sessionDomainKey` and `sessionDomainRef` bind the session to a domain object, the server may resolve the Agent deterministically from that registered domain mapping instead of accepting an explicit `agentRef`.

### Model Override

You can override the model for a specific session:

```json
{
  "agentRef": "architecture-reviewer@2",
  "modelId": "anthropic/claude-opus-4-5",
  "title": "Deep architecture review"
}
```

Available models are resolved per-invocation by the [Model Resolution Matrix](../xema-os/agent-composition/02-model-resolution.md).

### Repository & Branch Strategy

Link a session to a repository and choose how branches are managed:

| Strategy | Behavior |
|----------|----------|
| `auto_create` | Automatically creates a new branch when the agent makes changes |
| `use_existing` | Uses the repository's selected existing branch context |
| `none` | No SCM integration |

```json
{
  "agentRef": "engineering-assistant@3",
  "repositoryId": "repo-123",
  "branchStrategy": "auto_create"
}
```

### Budget Limit

Set a token budget to control costs:

```json
{
  "agentRef": "engineering-assistant@3",
  "budgetLimit": 200000
}
```

When the budget is near exhaustion:
- A `budget_warning` event is emitted
- You're notified in the session stream
- The agent wraps up current work

---

## Provisioning & Worker Assignment

Sessions go through a detailed provisioning sequence before becoming active. Each phase is observable:

| Phase | What's Happening |
|-------|-----------------|
| `queued` | Waiting for a worker to become available |
| `worker_launching` | Worker container spinning up |
| `worker_waiting_ready` | Container up, waiting for agent process |
| `credentials_injecting` | Resolving approved credential bindings for the runtime; long-lived provider secrets are not Agent configuration |
| `workspace_preparing` | Mounting repos, knowledge base, deliverable specs |
| `config_writing` | Writing agent configuration files |
| `config_reloading` | Agent reloading its configuration |
| `ready` | Provisioning complete ✓ |
| `failed` | Error occurred ✗ |

If provisioning fails, `failureReason` and `provisioningPhase` will indicate what went wrong.

---

## Conversation Threads

A session is the **workspace** — one worker, one set of files, one git checkout. The conversations that run on it are **threads**. Every session is created with one default thread (`Main`); open more to run parallel conversations against the same workspace.

- Each thread keeps its own message history and its own turn lock (`turnState`).
- Threads share the session's worker, files, tools, and git state.
- Threads run independently — one can be mid-turn while you type in another.
- A session always keeps at least one active thread; archiving or deleting the last one is rejected with `409`.

```bash
# Open a new thread on a session
POST /sessions/{id}/threads
{ "title": "Explore an alternative fix" }

# List the session's threads
GET /sessions/{id}/threads
```

Messages, history, and the streaming response are all addressed per thread — see [Real-Time Conversation](#real-time-conversation) below and the [API Reference](./03-api-reference.md#threads).

---

## Real-Time Conversation

### Streaming Messages

When you send a message, the response streams back as **Server-Sent Events (SSE)**. Each event type represents something the agent is doing:

| Event | Description |
|-------|-------------|
| `text_delta` | Streaming text output from the agent |
| `thinking` | Agent's reasoning process (visible when model supports it) |
| `tool_call` | Agent is invoking a tool |
| `file_change` | A file was created, edited, or deleted |
| `todo_updated` | Agent's task list was updated |
| `question_asked` | Agent has a question that needs your answer |
| `permission_asked` | Agent wants permission to do something (e.g., delete files) |
| `done` | Agent finished responding |
| `error` | An error occurred |

### Idempotent Message Sending

Messages support idempotency via a header, preventing duplicate sends on network retries:

```bash
curl -X POST .../sessions/{sessionId}/threads/{threadId}/messages \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"content": "Review authentication code"}'
```

### Question & Permission Cycles

Agents can pause and ask you questions or request permission:

**Agent asks a question:**
```
event: question_asked
data: {
  "questionId": "q_123",
  "question": "Should I use JWT or session cookies for authentication?"
}
```

**You answer:**
```bash
curl -X POST .../sessions/{sessionId}/questions/q_123/answer \
  -d '{"answer": "JWT, with 15-minute expiry and refresh tokens"}'
```

**Agent requests permission:**
```
event: permission_asked
data: {
  "permissionId": "perm_456",
  "action": "delete",
  "resource": "/src/legacy/old-auth.ts"
}
```

**You grant or deny:**
```bash
curl -X POST .../sessions/{sessionId}/permissions/perm_456/reply \
  -d '{"granted": true}'
```

---

## File & Code Operations

Agents can read and modify your codebase with full visibility:

### What the Agent Can Do

- **Read files** — Navigate the repository structure
- **Create files** — Generate new code, tests, docs
- **Edit files** — Refactor, fix bugs, add features
- **Delete files** — Remove obsolete code
- **Search codebase** — Find usages, definitions, patterns

### Observability

Every file change appears in the event stream in real time:

```
event: file_change
data: {
  "operation": "edited",
  "path": "src/auth/jwt.service.ts",
  "diff": "...",
  "timestamp": "2026-04-27T10:30:00Z"
}
```

---

## Git & Version Control

Sessions can manage the full git workflow:

### Branch Management

When `branchStrategy: auto_create`, the agent automatically creates a branch for the session (e.g., `interactive/fix-auth-abc123`). You can also:

```bash
# Create a specific branch
POST /sessions/{id}/git/branch
{ "branchName": "feature/improved-auth" }
```

### Committing Work

The agent can commit work at any time:

```bash
POST /sessions/{id}/git/commit
{ "message": "Refactor JWT auth to use RS256", "files": ["src/auth/jwt.service.ts"] }
```

### Pull Requests

When work is ready, the agent can open a pull request:

```bash
POST /sessions/{id}/git/pull-requests
{
  "title": "Refactor JWT authentication",
  "description": "Migrates from HS256 to RS256 with key rotation support",
  "baseBranch": "main"
}
```

The PR URL is stored on the session (`prUrl`).

### Git Status

Check the current git state at any time:

```bash
GET /sessions/{id}/git/status
# Returns: { branch, status, changes, commits, pullRequest? }

GET /sessions/{id}/git/merge-check?baseBranch=main
# Returns: { canMerge, conflicts, checks }
```

---

## Pause & Resume

### Pausing

Pause a session when you need to stop and continue later:

```bash
POST /sessions/{id}/pause
```

When paused:
1. Session must be `active` with every thread idle (wait for any in-flight turn to finish)
2. The full workspace snapshot (files, agent memory, conversation history) is saved
3. The worker is released back to the pool
4. Session transitions to `paused`

No work is lost — the session remembers everything.

### Resuming

```bash
POST /sessions/{id}/resume
```

When resuming:
1. A fresh worker is acquired from the pool
2. The saved session state is restored
3. The logical session continues from exactly where it left off

### Automatic Recovery

If a worker crashes while a session is active (e.g., infra failure), the session automatically:
1. Records `allocation_lost` as the pause reason
2. Transitions to a recoverable state
3. Auto-resumes on the next message you send

You don't need to manually intervene.

---

## Attachments & Extensions

### MCP Tool Selection

Pick the tools the agent is allowed to call on this session. The
selection is a single, ordered list — entries reference either an
entire provider (all its tools) or one specific tool from a provider.

```bash
PATCH /sessions/{id}/tools
{
  "selection": [
    { "kind": "provider", "providerKind": "mcp_server",            "resourceId": "<uuid>" },
    { "kind": "provider", "providerKind": "catalog",               "resourceId": "default-dev-tools" },
    { "kind": "tool",     "providerKind": "biome_workflow_tools", "resourceId": "<installation-id>", "toolName": "search-archive" },
    { "kind": "tool",     "providerKind": "biome_code_tools",     "resourceId": "<installation-id>", "toolName": "customer-lookup" }
  ]
}
```

The PATCH replaces the selection atomically. The platform's resolver
expands every entry into the agent's MCP config on next boot/resume.

**Use cases:**
- Attach a database MCP server to query databases.
- Curate a per-project catalog of tools every session inherits.
- Surface a biome's workflow as a single callable tool.
- Surface a biome's typed handler function as a single callable tool.

Drop everything with an empty list — the agent boots with no MCP tools
beyond the built-ins:
```bash
PATCH /sessions/{id}/tools
{ "selection": [] }
```

### Skills

Attach domain knowledge to guide the agent:

```bash
POST /sessions/{id}/skill-attachments
{
  "skillSlug": "backend-best-practices"
}
```

Skills are markdown files that inject patterns, conventions, and guidance into the agent's context (e.g., "always use dependency injection", "follow our API naming conventions").

### File Attachments

Attach specific files and resources:

| Kind | Description |
|------|-------------|
| `kb_page` | A knowledge base page |
| `uploaded_file` | A file you uploaded |
| `internal_url` | An internal resource URL |
| `repo_ref` | A reference to a specific file or path in a repo |
| `org_document` | An organization-level document |

```bash
POST /sessions/{id}/attachments
{
  "kind": "kb_page",
  "externalRef": "kb-page-456",
  "metadata": { "displayName": "API Design Standards" }
}
```

---

## Preview Apps

Sessions can run **live development servers** that you can preview in real time:

### How It Works

1. Agent starts a dev server (e.g., `npm run dev`)
2. Xema detects the server process and exposed port
3. A proxied public URL is created
4. You can open the URL and see the live app

### Supported Runtimes

- Next.js dev server
- Modern JavaScript bundler dev servers
- Python uvicorn
- Any HTTP server on a detectable port

### Preview Lifecycle

| Status | Description |
|--------|-------------|
| `detected` | Xema noticed a server starting |
| `installing` | Installing dependencies |
| `starting` | Server process is starting |
| `running` | Server ready and accessible via URL |
| `crashed` | Server exited unexpectedly |
| `stopped` | Intentionally stopped |

```bash
# List preview apps in session
GET /sessions/{id}/preview-apps

# Returns:
[{
  "id": "preview-123",
  "kind": "next_dev",
  "status": "running",
  "url": "https://preview.xema.dev/s/abc123/3000",
  "port": 3000
}]
```

---

## Budget & Limits

Track token usage in real time:

```json
{
  "tokenUsage": {
    "inputTokens": 45200,
    "outputTokens": 23100
  },
  "budgetLimit": 200000
}
```

**Budget warnings** are emitted as events:
```
event: budget_warning
data: {
  "usedTokens": 180000,
  "budgetLimit": 200000,
  "percentage": 90
}
```

At budget exhaustion, the session will not accept new messages until you increase the limit or end the session.

---

## Pipeline Integration

Sessions can be spawned by a workflow pipeline. When bound to a pipeline:

- `pipelineRunId` is set on the session
- The session receives the pipeline's context (deliverable specs, mount plan)
- The pipeline pauses at a human collaboration step while the session runs
- When the session completes, the pipeline resumes

A typical pipeline pattern:

1. Workflow run starts (e.g., triggered by PR)
2. Analysis jobs run automatically
3. Pipeline reaches an engineering job → spawns an interactive session
4. Engineer and agent collaborate in the session
5. Agent creates a PR or completes deliverables
6. Session completes → pipeline resumes
7. Remaining workflow steps execute (review, publish, notify)

See [Pipeline Integration](./02-pipeline-integration.md) for detailed examples.

---

## Session Forking

Fork a session to create an independent copy from its current state:

```bash
POST /sessions/{id}/fork
{
  "title": "Explore alternative approach"
}
```

The forked session:
- Starts from the exact same workspace state
- Has a different worker and history from this point on
- References the original session via `parentSessionId`

Use forking to explore multiple approaches without affecting the main session.

---

## Audit & History

### Event Stream Query

```bash
# Get all events for a session
GET /sessions/{id}/events

# Filter by type
GET /sessions/{id}/events?type=file_created

# Since a sequence number (for polling)
GET /sessions/{id}/events?afterSeq=42
```

### Message History

```bash
# Get a thread's conversation history
GET /sessions/{id}/threads/{threadId}/messages
```

### Session List

```bash
# List sessions for a project
GET /sessions?projectId=proj-123

# Filter by status
GET /sessions?status=active

# Filter by pipeline
GET /sessions?pipelineRunId=run-456
```

---

**Next**: [API Reference](./03-api-reference.md) for complete endpoint documentation.
