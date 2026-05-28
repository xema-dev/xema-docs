# Workspace Concepts

A workspace is a directory tree mounted into an agent's execution environment. It contains source repositories, reference files, seed data, deliverable output, and the skill bundles the agent needs. It is not ephemeral — the platform backs it with durable storage so sessions can resume exactly where they stopped.

---

## Storage pools

Workspace storage is managed by a pool of pre-provisioned volumes. When a session starts, `workspace-orchestrator-api` allocates a volume from the pool and mounts it as the session's workspace root.

Key design points:

- **Pools are pre-provisioned** — allocation is fast (sub-second) because volumes already exist. The pool is refilled asynchronously as sessions return volumes.
- **Sub-path isolation** — a single pool volume can serve multiple sessions using distinct sub-paths. This reduces volume churn for short-lived sessions.
- **Three isolation levels**: session-scoped, project-scoped, and org-scoped. Higher scopes allow sharing data between sessions in the same project or org.

---

## Sub-path layout

Within a workspace volume, paths are structured to prevent cross-session collision:

```
/xema/
  orgs/<orgId>/                          ← org-scoped storage
    projects/<projectId>/                ← project-scoped storage
      sessions/<sessionId>/              ← session-scoped storage (fully isolated)
        workspace/                       ← the agent's working directory
          .xema/                         ← platform-managed: skills, manifests, env
          repos/                         ← mounted source repositories
          artifacts/                     ← output artifacts
          tmp/                           ← ephemeral scratch space (cleared per turn)
```

Sessions in the same project share the `projects/<projectId>/` prefix for read-only project-level mounts (shared reference docs, shared deliverable outputs). Write operations are always session-scoped.

---

## Session persistence

Session state is preserved across:

- **Pod restarts** — the workspace is remounted when the pod comes back up.
- **Scale-down events** — the platform detects pending work and keeps the volume alive.
- **Session pauses** — a paused session releases its CPU/memory but retains its volume. Resume picks up the same workspace from where it stopped.

Persistence applies to the full workspace: in-progress files, installed tools, cached artifacts, and the agent's working state.

---

## Org, project, and session isolation

| Scope | What it covers | Shared with |
|---|---|---|
| Org | Org-wide shared resources (reference docs, shared skills) | All sessions in the org (read-only) |
| Project | Project artifacts, deliverable outputs, shared context | Sessions in the same project (read-only for non-owners) |
| Session | Active working directory, in-progress files, scratch space | Only the owning session |

Isolation is enforced at the file-system level (sub-path separation) and at the authorization level (workspace mounts are capability-gated).

---

## The AllocateWorkspace workflow

When a session requests a workspace, `workspace-orchestrator-api` runs the `AllocateWorkspaceWorkflow`:

1. Check the pool for an available volume matching the requested isolation scope.
2. If available: claim the volume, set up sub-paths, apply the session's workspace manifest.
3. If unavailable: provision a new volume (async), queue the session, notify when ready.
4. Mount source repositories, seed files, and skill bundles per the workspace manifest.
5. Return the mounted workspace path to the session runner.

The workflow is idempotent — retrying an allocation for the same session ID returns the already-allocated workspace.

---

**Previous**: ← (this is the first page in this section)

**Next**: [Git Workflow →](./02-git-workflow.md)
