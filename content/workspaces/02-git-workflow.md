# Git Workflow

Workspaces are connected to source control. Every agent turn that modifies files can be auto-committed; when the work is ready, a single command publishes changes to a production branch and opens a pull request.

---

## Auto-commit per turn

When `autoCommit` is enabled in the workspace manifest, the platform commits all workspace changes at the end of each agent turn:

```yaml
# workspace manifest excerpt
git:
  autoCommit: true
  commitMessage: "chore: agent turn {{ turnIndex }} — {{ summary }}"
```

Each commit is attributed to the actor that produced the changes — the agent identity, with the triggering user's identity as the author. Auto-commits are lightweight: they use `git add -A && git commit --allow-empty-message` under the hood and never push without an explicit `publish` command.

---

## Branch policy

Every session works on an isolated branch. Branch naming follows a deterministic policy:

```
xema/<sessionId>/<slugified-description>
```

Example: `xema/sess_01j9kz/pr-review-add-security-checks`

Sessions in the same project can share a branch with explicit opt-in (for collaborative editing). By default, each session gets its own branch.

---

## Publish to production

When the work is ready to merge, run:

```bash
xema workspace publish --target main
```

This:
1. Pushes the session branch to the remote.
2. Opens a pull request from the session branch to `main` (or the configured target branch).
3. Runs the configured CI checks.
4. Waits for required approvals before auto-merging (if `autoMerge: true` is set in the workspace manifest).

The command is available in the Xema Shell and as a workflow step (`kind: workspace-publish`).

---

## Conflict resolution

If the session branch diverges from the target branch, the platform detects the conflict and surfaces it in the active session:

1. The conflict is reported with a structured diff.
2. The agent can resolve conflicts programmatically (using the structured diff) or prompt the human participant for manual resolution.
3. After resolution, the publish resumes from the push step.

Conflict detection runs at publish time, not at each auto-commit. This keeps auto-commits fast.

---

## Reading back committed history

The workspace git history is accessible inside the session workspace at the standard `.git/` path. Agents can run `git log`, `git diff`, and `git blame` using the Xema Shell:

```bash
xema shell run --argv '["git", "log", "--oneline", "-10"]'
```

The shell runs in the session's workspace directory by default. All standard git commands are available.

---

**Previous**: [← Concepts](./01-concepts.md)

**Next**: [Multi-User Sessions →](./03-multi-user.md)
