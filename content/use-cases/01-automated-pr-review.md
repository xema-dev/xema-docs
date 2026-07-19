# Use Case: Automated PR Review Comment

> **Complexity**: Starter  
> **Trigger**: GitHub `pull_request.opened`  
> **Deliverable**: Structured code-review comment posted to the PR

---

## Goal

Reduce the feedback loop between a PR author and reviewers. Every time a pull request is opened Xema automatically analyses the diff and posts a structured summary comment with:
- files changed and their purpose
- potential issues detected
- suggested review focus areas

Human reviewers get a head-start; the agent does the boring part.

---

## Trigger

A GitHub webhook fires when a PR is opened against the `main` branch. The
`integration-adapters-api` normalises the event and dispatches a
`ScmWebhookEvent.PULL_REQUEST_OPENED` envelope to `workflow-engine-api`, which
matches it to this workflow.

---

## Steps

| Step | Type | Description |
|---|---|---|
| `fetch-diff` | Agent action | Fetches the PR diff from the SCM API |
| `review` | Agent action | Analyses the diff; produces a `code-review` deliverable |
| `post-comment` | HTTP action | Posts the deliverable content as a PR comment via SCM API |

---

## Deliverables

- **`code-review`** — A markdown document containing file-change summary, issues detected, and review focus areas. Stored as an artifact and posted as a PR comment.

---

## Workflow YAML

```yaml
apiVersion: workflow/v1alpha1
kind: Workflow
metadata:
  name: automated-pr-review
  version: "1.0.0"

on:
  webhook:
    provider: github
    event: pull_request.opened
    filters:
      targetBranch: main

inputs:
  prNumber:
    type: number
    source: "{{ event.pull_request.number }}"
  repoFullName:
    type: string
    source: "{{ event.repository.full_name }}"
  diffUrl:
    type: string
    source: "{{ event.pull_request.diff_url }}"

jobs:
  fetch-diff:
    action: scm-connector-api.fetch-diff@1.0.0
    input:
      repoFullName: "{{ inputs.repoFullName }}"
      prNumber: "{{ inputs.prNumber }}"

  review:
    needs: [fetch-diff]
    action: platform.agent@1.0.0
    input:
      task: |
        Review the following pull request diff and produce a structured code-review document.
        Include: summary of changes, files affected, potential issues, and suggested review focus areas.
        Format as markdown with clear sections.
      context:
        diff: "{{ jobs.fetch-diff.outputs.diff }}"
      deliverableSpec: code-review-v1
    output:
      artifactKey: code-review

  post-comment:
    needs: [review]
    action: scm-connector-api.post-pr-comment@1.0.0
    input:
      repoFullName: "{{ inputs.repoFullName }}"
      prNumber: "{{ inputs.prNumber }}"
      body: "{{ jobs.review.outputs.artifact.content }}"
```

---

## Extending It

- **Conditional posting** — Only post the comment if `review.outputs.issueCount > 0`.
- **Severity gating** — Add a `gate.humanApproval` step that blocks merge if the agent flags a high-severity issue.
- **Multi-provider** — Add a second `on.webhook` block for `gitlab` using the same workflow body.
- **Custom spec** — Swap `code-review-v1` for your own deliverable spec to enforce team-specific review criteria.

---

**Next**: [Scheduled Security Audit →](./02-scheduled-security-audit.md)
