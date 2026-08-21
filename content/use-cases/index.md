# Use Cases

> API Docs: https://workflow-engine-api.xema.dev/api/docs

Five worked examples, from a single-event automation to a full multi-phase delivery pipeline. Each one is complete enough to run.

They are ordered so that each adds exactly one idea to the previous. That ordering is the point: it is also the order in which the platform's concepts stop being optional.

---

## Browse

| Use Case | What it does | New idea it introduces | Complexity |
|---|---|---|---|
| [Automated PR Review Comment](./01-automated-pr-review.md) | Post a structured code-review summary whenever a pull request is opened | An external event triggers an agent; the connector carries the credential | Starter |
| [Scheduled Security Audit](./02-scheduled-security-audit.md) | Run CVE scans across your repos on a schedule and emit a findings report | Nothing external triggers it; the output is a durable artifact | Intermediate |
| [Spec Generation from Backlog](./03-spec-from-backlog.md) | Turn a tracker issue into a deliverable specification document | The output has a *contract* — a deliverable spec that validates it | Intermediate |
| [Feature Lifecycle Pipeline](./04-feature-lifecycle.md) | Brainstorming → architecture → requirements → engineering session → PR → governance review | Phases, gates, and a human in the middle of a durable run | Advanced |
| [Multi-Repo Audit with Custom Overlays](./05-multi-repo-audit-overlays.md) | Audit many repositories from one base spec with per-repo customization | Matrix expansion and overlay composition | Advanced |

---

## What these examples are really demonstrating

Read past the YAML and the same four things are happening every time. They are worth naming, because they are what makes the fifth example no harder to reason about than the first.

**Every external event enters through one door.** A GitHub webhook, a Jira update, a Slack message — all of it arrives at the connector gateway, is verified there, and is handed to the rest of the platform as a canonical envelope with a deterministic idempotency key. Your workflow never parses a provider payload and never sees a signature.

**Every action leaves through one door.** The agent that posts the review comment does not hold a GitHub token. It invokes a capability; the gateway resolves which connection to use and mints a short-lived credential bound to that one invocation.

**Every step is a decision that was recorded.** The agent's authority is the intersection of what it is armed with, its reach tier, and what its owner can do. That decision is made once, at the funnel, by the same policy engine that decides whether a person may click a button.

**Nothing is lost when something takes a long time.** A pipeline that waits three days for a human approval is not a process holding a socket open. Runs are durable, and each organization gets its own workflow-engine namespace — its own state, history, signals, and retention.

---

## How to read an example

Each use case follows the same structure:

1. **Goal** — the business problem.
2. **Trigger** — what starts it.
3. **Steps** — the phases and actions that run.
4. **Deliverables** — the artifacts produced.
5. **Workflow YAML** — a complete definition.
6. **Extending it** — where to take it next.

Two things worth doing on your first read: notice which parts you would have had to build yourself elsewhere, and notice that the last example uses the same primitives as the first.

---

## Starting from scratch

If you have not run anything yet:

1. [Workflows: concepts](../workflows/01-concepts.md) — the execution model in one page.
2. [DSL reference](../dsl/01-reference.md) — the language these examples are written in.
3. [Automated PR Review Comment](./01-automated-pr-review.md) — the smallest thing that does real work.

If you are extending the platform rather than using it, start at [Biomes](../biomes/) instead — a use case is something you *run*; a biome is something you *ship*.

---

**Start simple** with [Automated PR Review Comment](./01-automated-pr-review.md) and work your way up.
