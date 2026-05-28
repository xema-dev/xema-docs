# Use Cases

> API Docs: https://workflow-engine-api.xema.dev/api/docs

Real-world examples of what you can build with Xema. Examples progress from a single-event automation to a fully integrated multi-phase delivery pipeline.

---

## Browse Use Cases

| Use Case | What it does | Complexity |
|---|---|---|
| [Automated PR Review Comment](./01-automated-pr-review.md) | Post a structured code-review summary whenever a pull request is opened | Starter |
| [Scheduled Security Audit](./02-scheduled-security-audit.md) | Run CVE scans across your repos on a cron schedule and emit a findings report | Intermediate |
| [Spec Generation from Backlog](./03-spec-from-backlog.md) | Turn a Jira/Linear issue into a deliverable specification document | Intermediate |
| [Feature Lifecycle Pipeline](./04-feature-lifecycle.md) | Orchestrate brainstorming → architecture → requirements → engineering session → PR → governance review | Advanced |
| [Multi-Repo Audit with Custom Overlays](./05-multi-repo-audit-overlays.md) | Audit multiple repositories using a shared base spec and per-repo overlay customization | Advanced |

---

## How to Read These Examples

Each use case follows the same structure:

1. **Goal** — What business problem this solves.
2. **Trigger** — What event starts the workflow.
3. **Steps** — The phases/actions that run.
4. **Deliverables** — What artifacts and outputs are produced.
5. **Workflow YAML** — A complete, runnable workflow definition.
6. **Extending It** — Ideas for customising the example.

---

**Start simple** with [Automated PR Review Comment](./01-automated-pr-review.md) and work your way up.
