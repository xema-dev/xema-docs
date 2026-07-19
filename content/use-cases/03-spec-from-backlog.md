# Use Case: Spec Generation from Backlog

> **Complexity**: Intermediate  
> **Trigger**: Jira issue moved to "Ready for Spec" status  
> **Deliverable**: Deliverable specification document, linked back to the Jira issue

---

## Goal

Close the gap between a backlog item and an actionable specification. When a product or engineering manager moves a Jira issue into the "Ready for Spec" column, Xema automatically generates a full deliverable specification document — requirements, acceptance criteria, technical constraints — and links it back to the issue.

The team gets a structured starting point for implementation instead of a blank page.

---

## Trigger

A Jira webhook fires when an issue transitions to `status: "Ready for Spec"`. The `connector-gateway-api` normalises the event to a `TrackerWebhookEvent.ISSUE_TRANSITIONED` envelope and dispatches it to the workflow engine.

---

## Steps

| Step | Type | Description |
|---|---|---|
| `enrich` | Agent action | Fetches linked issues, Epic context, and comments from Jira |
| `generate-spec` | Agent action | Drafts the deliverable specification from the enriched context |
| `review-gate` | Human approval | Assignee or PM reviews and approves/rejects the draft |
| `link-back` | HTTP action | Attaches the final spec artifact URL to the Jira issue and transitions it to "Spec Ready" |

---

## Deliverables

- **`deliverable-spec`** — A fully structured specification document including requirements, acceptance criteria, out-of-scope items, and technical notes. Stored as a versioned artifact.

---

## Workflow YAML

```yaml
apiVersion: workflow/v1alpha1
kind: Workflow
metadata:
  name: spec-from-backlog
  version: "1.0.0"

on:
  webhook:
    provider: jira
    event: issue.transitioned
    filters:
      toStatus: "Ready for Spec"

inputs:
  issueKey:
    type: string
    source: "{{ event.issue.key }}"
  issueSummary:
    type: string
    source: "{{ event.issue.fields.summary }}"
  issueDescription:
    type: string
    source: "{{ event.issue.fields.description }}"
  assigneeEmail:
    type: string
    source: "{{ event.issue.fields.assignee.emailAddress }}"

jobs:
  enrich:
    action: platform.agent@1.0.0
    input:
      task: |
        Retrieve all available context for Jira issue {{ inputs.issueKey }}:
        - Parent Epic details and goals
        - Linked issues (dependencies, blockers, related)
        - Recent comments and decisions
        - Labels and components
        Summarise this context for use in spec generation.
      context:
        issueKey: "{{ inputs.issueKey }}"
        summary: "{{ inputs.issueSummary }}"
        description: "{{ inputs.issueDescription }}"
    output:
      artifactKey: enriched-context

  generate-spec:
    needs: [enrich]
    action: platform.agent@1.0.0
    input:
      task: |
        Using the backlog item context below, produce a complete deliverable specification.
        Include:
        - Problem statement and business goal
        - Functional requirements (user-story format)
        - Non-functional requirements (performance, security, accessibility)
        - Acceptance criteria (checkboxes)
        - Out-of-scope items
        - Open questions
        - Suggested technical approach (optional)
      context:
        issueContext: "{{ jobs.enrich.outputs.artifact.content }}"
      deliverableSpec: deliverable-spec-v1
    output:
      artifactKey: deliverable-spec

  review-gate:
    needs: [generate-spec]
    gate:
      humanApproval:
        assignees:
          - "{{ inputs.assigneeEmail }}"
        timeoutAction: escalate
        timeoutHours: 48
        message: |
          A specification has been generated for {{ inputs.issueKey }}: {{ inputs.issueSummary }}.
          Please review and approve or reject it.
          Spec: {{ jobs.generate-spec.outputs.artifact.url }}

  link-back:
    needs: [review-gate]
    action: platform.agent@1.0.0
    input:
      task: |
        Attach the approved specification artifact to Jira issue {{ inputs.issueKey }},
        add a comment with the artifact URL, and transition the issue to "Spec Ready".
      context:
        issueKey: "{{ inputs.issueKey }}"
        artifactUrl: "{{ jobs.generate-spec.outputs.artifact.url }}"
```

---

## Extending It

- **Slack notification** — Add a step to notify the team channel when a spec is ready for review.
- **Multiple spec templates** — Use the issue's `component` label to select between `frontend-spec-v1`, `api-spec-v1`, or `infra-spec-v1`.
- **Overlay customization** — Apply team-specific overlays to the base `deliverable-spec-v1` spec (e.g., add security-checklist requirements for the security team).
- **Linear support** — Swap the `jira` webhook trigger for `linear.issue.transitioned` with the same workflow body.

---

**Previous**: [← Scheduled Security Audit](./02-scheduled-security-audit.md)  
**Next**: [Feature Lifecycle Pipeline →](./04-feature-lifecycle.md)
