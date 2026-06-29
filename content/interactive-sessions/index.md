# Interactive Sessions

> API Docs: https://agent-session-api.xema.dev/api/docs

Interactive sessions are **long-lived, stateful collaboration environments** where you and AI agents work together in real time — exploring codebases, writing code, reviewing changes, creating documents, and more.

## What is an Interactive Session?

Unlike a single-shot workflow job, an interactive session is a **persistent workspace** where:

- You and an AI agent have a **live conversation**
- The agent has access to your **codebase, tools, knowledge base**, and more
- You can **pause and resume** without losing progress
- All actions are logged in an **immutable event ledger**
- The session can create branches, commit code, open pull requests
- The agent can spin up **live development servers** you can preview
- A session can host multiple **conversation threads** over one shared workspace

A session can be:
- **Standalone** — a direct conversation with an agent for exploration or tasks
- **Pipeline-bound** — launched as part of a workflow run (e.g., the engineering phase)

---

## Session Lifecycle

```
Creating → Provisioning → Active → Paused → Recovering → Active
            ↓                               ↓
          Failed                         Completed
                               ↓
                             Archived
```

| State | Description |
|-------|-------------|
| `creating` | Initial state; acquiring a worker from the pool |
| `provisioning` | Worker is being set up (mounting workspace, tools, model config) |
| `active` | Ready — you can send messages and interact |
| `paused` | Session snapshot saved, worker released, waiting for you to resume |
| `recovering` | Resume is in flight: acquiring a worker and restoring the saved state |
| `completed` | Session ended successfully |
| `failed` | Worker or provisioning error |
| `archived` | Soft-deleted, kept for history |

### What Happens During Provisioning

When you create a session, the platform:

1. Allocates a worker from the agent pool
2. Boots the worker and waits for readiness
3. Injects credentials and secrets
4. Prepares the workspace (mounts repos, knowledge base, deliverable specs)
5. Writes agent configuration (model, tools, skills)
6. Reloads the agent config
7. Verifies the language model is available
8. Verifies tools and MCP servers are accessible
9. Marks session as `active`

Each phase is tracked as a `provisioningPhase` in the session, so you can diagnose any failure point.

---

## Key Capabilities

### 💬 Real-Time Conversation

Send messages to the agent and receive streaming responses. The agent can:

- Answer questions about your codebase
- Explain code, architectures, designs
- Generate new code, tests, documentation
- Review and suggest improvements
- Execute multi-step tasks autonomously

### 🔧 Tool Execution

Agents use tools to perform real actions:

- **File operations** — Read, create, edit, delete files
- **Git operations** — Create branches, commit, push, open PRs
- **Web search** — Look up external documentation
- **Code execution** — Run scripts, tests, build commands
- **MCP tools** — Any tool attached via Model Context Protocol

### 📁 File & Git Operations

Sessions track every file change and git operation:

- `file_created`, `file_edited`, `file_deleted`
- `git_branch_created`, `git_committed`, `git_pushed`
- `pr_created` — auto-creates a PR when work is ready

### ⏸️ Pause & Resume

Sessions can be paused and resumed without losing state:

- Pausing saves a snapshot of the workspace (agent memory, files, history)
- Resuming restores the same logical session on a fresh worker
- The worker allocation may change, but the session identity and restored conversation/workspace state do not
- No work lost — the agent continues from where it left off

### 🖥️ Preview Apps

Sessions can detect and expose live development servers:

- Automatically detected (Next.js dev, modern bundler dev servers, Python uvicorn, etc.)
- Accessible via a proxied public URL
- Status tracked: `running`, `crashed`, `stopped`

### 🔌 Attachments & Extensions

Extend session capabilities at any time:

- **MCP Servers** — Attach external tools (databases, APIs, code tools)
- **Skills** — Attach domain knowledge (testing best practices, security guidelines)
- **Files** — Attach knowledge base pages, uploaded documents, repo references
- **Sub-agents** (Delegates) — Bind extra agents the primary can hand off focused work to via its `task` tool. See [Sub-agents](./04-sub-agents.md) for the model.
- **Biome contributions** — Biomes extend the session UI itself: slash commands, drawer tabs, activity renderers, tool-call renderers, mutation bars, header chips, attachment classes, and per-profile capability flags. See [Biomes · Authoring § Session contributions](../biomes/02-authoring.md) for the full taxonomy.

### 🔗 Knowledge & Context

Agents can access:

- Attached knowledge base spaces
- Specific KB pages
- Uploaded files and documents
- Repository references
- Org-level documents

---

## Conversation Threads

A session is the **workspace** — one worker, one set of files, one git checkout. The conversations that run on it are **threads**. Every session starts with one default thread (`Main`); open more to explore separate lines of work against the same workspace.

- Each thread keeps its own message history and its own turn lock.
- Threads share the session's worker, files, tools, and git state.
- Threads run independently — one thread can be mid-turn while you type in another.
- A session always retains at least one active thread.

Messages, the streaming response, and message/event history are addressed by `(sessionId, threadId)`. See the [API Reference](./03-api-reference.md#threads).

---

## Turn Model

Each **thread** processes one message at a time via a per-thread **turn lock**:

```
User sends message to a thread
  → Thread turn lock acquired
  → Agent processes message (streaming response)
  → Events logged: tool calls, file changes, git ops, etc.
  → Thread turn lock released (idle)
  → Thread ready for the next message
```

| Turn State | Meaning |
|------------|---------|
| `idle` | Thread is ready to receive a message |
| `executing` | Agent is processing a message on this thread |
| `interrupting` | User triggered an interruption mid-turn |

`turnState` belongs to the **thread**, not the session — two threads on the same session can be in different turn states at once.

---

## Session & Pipeline Integration

Sessions can be bound to a **pipeline run** (`pipelineRunId`). When this happens:

- The session is part of a larger workflow execution
- The session receives context from the pipeline (phase, deliverable specs, mounts)
- When the session completes, results flow back to the pipeline
- The pipeline can gate on the session result (approval, artifact quality)

See [Pipeline Integration Examples](../dsl/examples/pipeline-integration.md) for workflow examples that spawn sessions.

---

## Event Ledger

Every action in a session is recorded as an immutable event:

| Category | Events |
|----------|--------|
| Chat | `message_sent`, `message_received` |
| Tools | `tool_call_started`, `tool_call_completed` |
| Files | `file_created`, `file_edited`, `file_deleted` |
| Git | `git_branch_created`, `git_committed`, `git_pushed`, `pr_created` |
| Knowledge | `kb_page_pushed` |
| Lifecycle | `status_changed`, `session_paused`, `session_resumed` |
| Attachments | `attachment_added`, `skill_attached`, `skill_detached` |
| Human | `question_asked`, `question_answered`, `permission_asked`, `permission_replied` |
| Preview Apps | `preview_detected`, `preview_ready`, `preview_exited` |
| Budget | `budget_warning` |
| Errors | `error` |

The event ledger is the canonical audit record of everything that happened.

---

## Quick Start

### Start a Session

```bash
curl -X POST https://agent-session-api.xema.dev/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "profileKey": "session",
    "title": "Fix authentication module"
  }'
```

### Start a Domain-Projected Session (No Hardcoded Profile)

```bash
curl -X POST https://agent-session-api.xema.dev/sessions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Design review for auth hardening",
    "sessionDomainKey": "design-review",
    "sessionDomainRef": "dr_01j2abcxyz"
  }'
```

### Send a Message

```bash
curl -X POST https://agent-session-api.xema.dev/sessions/{sessionId}/threads/{threadId}/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "content": "Can you review the authentication code and suggest improvements?"
  }'
```

### Check Status

```bash
curl https://agent-session-api.xema.dev/sessions/{sessionId} \
  -H "Authorization: Bearer $TOKEN"
```

---

## Pages in This Section

- **[Features](./01-features.md)** — Full feature reference
- **[Pipeline Integration](./02-pipeline-integration.md)** — Using sessions in workflows
- **[API Reference](./03-api-reference.md)** — REST API endpoints
- **[Sub-agents](./04-sub-agents.md)** — Bind delegates the primary can call into
- **[Domain Projections](./04-domain-projections.md)** — Build custom modes (for example design review) on top of the shared runtime
- **[Examples](./examples/index.md)** — Step-by-step implementation guides for custom interactive modes

---

## See Also

- [Workflows Overview](../workflows/index.md)
- [DSL Examples with Sessions](../dsl/examples/agent-sessions.md)
- [Pipeline Integration Examples](../dsl/examples/pipeline-integration.md)
