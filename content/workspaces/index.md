# Workspaces

> API Docs: https://workspace-orchestrator-api.xema.dev/api/docs

A **workspace** is the isolated, persistent environment where an agent does its work. Every interactive session and workflow execution runs in its own workspace: a directory tree with mounted repositories, reference files, seed data, and environment context.

In Xema, workspaces are **persistent by default**. They survive pod restarts, scale-down events, and session pauses. Storage is backed by durable volumes, not ephemeral container filesystems. An agent can pick up exactly where it left off.

## Quick Links

| Page | What it covers |
|---|---|
| [Concepts](./01-concepts.md) | Storage pools, sub-path layout, session persistence, isolation model |
| [Git Workflow](./02-git-workflow.md) | Auto-commit, branch policy, publish-to-prod, conflict resolution |
| [Multi-User Sessions](./03-multi-user.md) | Participants, actor attribution, real-time collaboration |
| [Worker Runtime](./04-worker-runtime.md) | WorkerRuntime driver, Kubernetes and Docker schedulers, cold-start |
| [Image Variants](./05-image-variants.md) | Per-org Docker image variants, Kaniko builds, base-image cascade |
| [Versioning Lockfile](./06-versioning-lockfile.md) | Lockfile, one-click update, rollback |
| [Examples](./examples/) | Worked examples |

## Getting Started

1. **[Concepts](./01-concepts.md)** — understand how storage pools and isolation work.
2. **[Git Workflow](./02-git-workflow.md)** — see how workspace changes flow back to source control.
3. **[Worker Runtime](./04-worker-runtime.md)** — understand what runs inside a workspace.
4. **[Versioning Lockfile](./06-versioning-lockfile.md)** — lock and update dependencies.

## FAQ

**Q: Does a workspace persist between sessions?**
A: Yes. Storage is PVC-backed per session and survives pod restarts. Sessions in the same project share project-level storage; sessions of the same user share user-level storage. Separate users get separate storage trees.

**Q: Can multiple people work in the same workspace at once?**
A: Yes. See [Multi-User Sessions](./03-multi-user.md) for the participant model and actor attribution.

**Q: Can I use a custom base image?**
A: Yes. Per-org Docker image variants let orgs ship their own toolchain. See [Image Variants](./05-image-variants.md).
