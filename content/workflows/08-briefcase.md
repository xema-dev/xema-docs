# Briefcase

A **Briefcase** is the run-scoped bundle of extra context a caller attaches when starting a workflow run — uploaded files, pointers to existing platform content, key/value facts, and optional tools. It travels with the run from dispatch to completion, and every job can draw on it.

The Briefcase gives every workflow one consistent way to accept attachments. Rather than each workflow declaring its own `uploads`/`references` input fields, callers pass a single Briefcase and the runtime delivers it everywhere.

---

## What's in a Briefcase

A Briefcase has four slots, all optional:

| Slot | What it holds |
|---|---|
| `vars` | A string-to-string map of run-scoped facts — for example `designSystemVersion`, `targetEnvironment`, `kbSpaceSlug`. |
| `uploads` | Files the caller attached at dispatch. Each is stored as a Xema artifact so any job can fetch its bytes. |
| `references` | Pointers to content the run should treat as authoritative — knowledge-base pages or spaces, existing artifacts, repositories, or external URLs. |
| `mcpTools` | Optional tool providers that augment whatever tools an agent step already has. |

A Briefcase is a **container, not a contract**: each slot may be empty, and each job takes what it needs and ignores the rest.

---

## Attaching a Briefcase at dispatch

Pass a `briefcase` object in the body of `POST /workflows/{slug}/runs`:

```json
{
  "projectId": "proj-1",
  "inputs": { "request": "Add a dark-mode theme" },
  "briefcase": {
    "vars": {
      "designSystemVersion": "4.2.0",
      "targetEnvironment": "staging"
    },
    "references": [
      { "kind": "kb_space", "ref": "design-system", "title": "Design System" },
      { "kind": "scm_repo", "ref": "acme/web-app", "title": "Web app repo" }
    ]
  }
}
```

A `references` entry's `kind` is one of `kb_page`, `kb_space`, `artifact`, `scm_repo`, or `external_url`. An `uploads` entry is a file stored as a Xema artifact (carrying its filename, content type, and size); an `mcpTools` entry selects a tool provider or a single tool. The exact request schema for every slot is in the live API docs for the run-start endpoint (`https://workflow-engine-api.xema.dev/api/docs`).

The Briefcase is **entirely optional** — omit it (or send an empty object) when the run needs nothing extra.

---

## Lifecycle

A Briefcase is **run-scoped and ephemeral**:

- It is synthesized once, at dispatch, from the `briefcase` field of the start-run request.
- Exactly **one** Briefcase exists per run.
- It is carried on the run's compiled snapshot and made available to every job for the life of the run.
- It is discarded when the run terminates. There is no Briefcase library, no cross-run reuse, and no separate versioning — each run gets a fresh one.

Because the Briefcase is frozen into the run's snapshot at dispatch, a paused run resumes with exactly the Briefcase it started with.

---

## How workflows consume it

Workflow authors do **not** declare a Briefcase in YAML. Jobs simply receive it:

- **Agent steps** — `uploads` and `references` are added to the agent's workspace as mounted files automatically; the agent reads them like any other input. `mcpTools` are merged into the agent's available tools for that run (they only ever add tools, never remove them).
- **Other jobs** — non-agent jobs can read `vars`, `uploads`, and `references` through the runtime's typed accessors, picking whatever they need.

This means the same workflow handles "dispatched with a Briefcase" and "dispatched without one" with no conditional logic — absent slots are simply empty.

---

## Briefcase vs workflow inputs and vars

The Briefcase is *additional context*, not a replacement for a workflow's declared interface:

| Use… | For… |
|---|---|
| `on.workflow_dispatch.inputs` | The workflow's required, typed parameters — validated against its schema at compile time. |
| Workflow `vars:` | Run-wide constants the workflow author defines and controls. |
| Briefcase `vars` | Run-scoped facts the *caller* supplies at dispatch, that the workflow did not declare up front. |
| Briefcase `uploads` / `references` | Files and content pointers the caller wants the run to consider. |

Keep workflow-wide identifiers such as `projectId` in the dispatch request and the workflow's own fields — not in the Briefcase.

---

**Previous**: [← API Reference](./07-api-reference.md)
