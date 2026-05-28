# Use Case: Feature Lifecycle Pipeline

> **Complexity**: Advanced  
> **Trigger**: Manual dispatch or Jira issue reaching "Approved for Build"  
> **Deliverables**: Architecture doc, requirements spec, implementation PR, governance review report

---

## Goal

Orchestrate an entire feature — from initial brainstorming to a merged pull request with a governance sign-off — inside a single, auditable workflow. Every phase produces a versioned artifact. Human gates ensure the right people approve before work progresses.

This is the flagship Xema use case: a fully integrated software delivery pipeline that replaces ad-hoc Slack threads and manual hand-offs with a deterministic, repeatable process.

---

## Trigger

Manual dispatch (via the Xema UI or API) or automatically when a Jira issue transitions to `"Approved for Build"`. The workflow can run for days or weeks — durable execution keeps it alive across restarts.

---

## Phases

```
Brainstorming
    │  ✅ idea-brief artifact
    ▼
Architecture Design
    │  ✅ architecture doc artifact
    │  🔒 architecture approval gate (tech leads)
    ▼
Requirements & Spec
    │  ✅ deliverable spec artifact
    │  🔒 spec approval gate (PM + engineering lead)
    ▼
Engineering Session
    │  ✅ implementation branch + PR
    │  (Interactive session — agent + human collaboration)
    ▼
Automated Review
    │  ✅ code-review artifact
    ▼
Governance Review
    │  🔒 governance gate (security + compliance)
    ▼
Merge & Close
    │  ✅ Jira transition to "Done"
    └─ Slack notification
```

---

## Steps

| Step | Type | Description |
|---|---|---|
| `brainstorm` | Agent action | Explores the feature idea; produces a concise idea-brief |
| `arch-design` | Agent action | Drafts architecture doc — system context, component design, data flow, risks |
| `arch-gate` | Human approval | Tech leads review and approve or request changes |
| `requirements` | Agent action | Generates full requirements spec from architecture doc |
| `spec-gate` | Human approval | PM and engineering lead approve the spec |
| `engineering-session` | Interactive session | Agent + human pair to implement the feature; emits a PR |
| `automated-review` | Agent action | Reviews the PR diff against the spec; flags deviations |
| `governance-review` | Agent action | Runs security, compliance, and policy checks |
| `governance-gate` | Human approval | Security lead approves or blocks merge |
| `merge-and-close` | Agent action | Merges the PR; transitions Jira issue to "Done"; notifies team |

---

## Workflow YAML

```yaml
apiVersion: workflow/v1alpha1
kind: Workflow
metadata:
  name: feature-lifecycle-pipeline
  version: "1.0.0"

on:
  manual:
    inputs:
      - name: featureTitle
        type: string
        required: true
      - name: issueKey
        type: string
        required: false
      - name: repoFullName
        type: string
        required: true
  webhook:
    provider: jira
    event: issue.transitioned
    filters:
      toStatus: "Approved for Build"

inputs:
  featureTitle:
    type: string
    source: "{{ trigger.inputs.featureTitle | default: event.issue.fields.summary }}"
  issueKey:
    type: string
    source: "{{ trigger.inputs.issueKey | default: event.issue.key }}"
  repoFullName:
    type: string
    source: "{{ trigger.inputs.repoFullName | default: event.issue.fields.customfield_repo }}"
  techLeads:
    type: array
    default: ["{{ env.TECH_LEADS_EMAIL }}"]
  pmEmail:
    type: string
    default: "{{ env.PM_EMAIL }}"
  securityLeadEmail:
    type: string
    default: "{{ env.SECURITY_LEAD_EMAIL }}"

jobs:
  brainstorm:
    action: platform.agent@1.0.0
    input:
      task: |
        Explore the following feature idea and produce a concise idea brief.
        Include: problem statement, proposed solution, key assumptions,
        risks, and success metrics.
      context:
        featureTitle: "{{ inputs.featureTitle }}"
        issueKey: "{{ inputs.issueKey }}"
      deliverableSpec: idea-brief-v1
    output:
      artifactKey: idea-brief

  arch-design:
    needs: [brainstorm]
    action: platform.agent@1.0.0
    input:
      task: |
        Design the architecture for the feature described in the idea brief below.
        Produce: system context diagram (mermaid), component breakdown,
        data flow, API contracts (draft), risks and mitigations.
      context:
        ideaBrief: "{{ jobs.brainstorm.outputs.artifact.content }}"
      deliverableSpec: architecture-doc-v1
    output:
      artifactKey: architecture-doc

  arch-gate:
    needs: [arch-design]
    gate:
      humanApproval:
        assignees: "{{ inputs.techLeads }}"
        timeoutHours: 72
        timeoutAction: escalate
        message: |
          Architecture document ready for review — {{ inputs.featureTitle }}.
          Doc: {{ jobs.arch-design.outputs.artifact.url }}

  requirements:
    needs: [arch-gate]
    action: platform.agent@1.0.0
    input:
      task: |
        Produce a full requirements specification based on the approved architecture document.
        Include: user stories, functional requirements, non-functional requirements,
        acceptance criteria, out-of-scope items, and open questions.
      context:
        architectureDoc: "{{ jobs.arch-design.outputs.artifact.content }}"
      deliverableSpec: deliverable-spec-v1
    output:
      artifactKey: requirements-spec

  spec-gate:
    needs: [requirements]
    gate:
      humanApproval:
        assignees:
          - "{{ inputs.pmEmail }}"
          - "{{ inputs.techLeads[0] }}"
        timeoutHours: 48
        timeoutAction: notify
        message: |
          Requirements spec ready for approval — {{ inputs.featureTitle }}.
          Spec: {{ jobs.requirements.outputs.artifact.url }}

  engineering-session:
    needs: [spec-gate]
    action: platform.agent-session@1.0.0
    input:
      task: |
        Implement the feature described in the spec below in repository {{ inputs.repoFullName }}.
        Create a feature branch, implement the changes, and open a pull request when done.
      context:
        spec: "{{ jobs.requirements.outputs.artifact.content }}"
        architectureDoc: "{{ jobs.arch-design.outputs.artifact.content }}"
      repo: "{{ inputs.repoFullName }}"
    output:
      prUrl: "{{ outputs.prUrl }}"
      branchName: "{{ outputs.branchName }}"

  automated-review:
    needs: [engineering-session]
    action: platform.agent@1.0.0
    input:
      task: |
        Review the pull request diff against the requirements spec.
        Flag any deviations, missing acceptance criteria, or quality issues.
        Produce a code-review document.
      context:
        prUrl: "{{ jobs.engineering-session.outputs.prUrl }}"
        spec: "{{ jobs.requirements.outputs.artifact.content }}"
      deliverableSpec: code-review-v1
    output:
      artifactKey: code-review

  governance-review:
    needs: [automated-review]
    action: platform.agent@1.0.0
    input:
      task: |
        Run a governance review for the pull request.
        Check: security (OWASP Top 10), dependency policy, data handling,
        compliance with org policies.
        Produce a governance report with a pass/fail recommendation.
      context:
        prUrl: "{{ jobs.engineering-session.outputs.prUrl }}"
        codeReview: "{{ jobs.automated-review.outputs.artifact.content }}"
      deliverableSpec: governance-review-v1
    output:
      artifactKey: governance-report

  governance-gate:
    needs: [governance-review]
    gate:
      humanApproval:
        assignees:
          - "{{ inputs.securityLeadEmail }}"
        timeoutHours: 24
        timeoutAction: fail
        message: |
          Governance review requires sign-off — {{ inputs.featureTitle }}.
          Report: {{ jobs.governance-review.outputs.artifact.url }}
          PR: {{ jobs.engineering-session.outputs.prUrl }}

  merge-and-close:
    needs: [governance-gate]
    action: platform.agent@1.0.0
    input:
      task: |
        Merge the approved pull request {{ jobs.engineering-session.outputs.prUrl }}.
        Transition Jira issue {{ inputs.issueKey }} to "Done".
        Post a Slack message to the team channel announcing the feature is merged.
      context:
        prUrl: "{{ jobs.engineering-session.outputs.prUrl }}"
        issueKey: "{{ inputs.issueKey }}"
        featureTitle: "{{ inputs.featureTitle }}"
        artifactUrls:
          ideaBrief: "{{ jobs.brainstorm.outputs.artifact.url }}"
          architectureDoc: "{{ jobs.arch-design.outputs.artifact.url }}"
          requirementsSpec: "{{ jobs.requirements.outputs.artifact.url }}"
          codeReview: "{{ jobs.automated-review.outputs.artifact.url }}"
          governanceReport: "{{ jobs.governance-review.outputs.artifact.url }}"
```

---

## Extending It

- **Phase gating with quality scores** — Use agent outputs (e.g. `codeQualityScore > 80`) as conditional gates to skip or add steps dynamically.
- **Custom deliverable specs** — Replace `architecture-doc-v1` and `deliverable-spec-v1` with team-specific specs using overlays.
- **Parallel sub-pipelines** — Split the engineering phase into parallel frontend and backend sessions that merge before governance review.
- **Multi-repo features** — Use a matrix strategy over `[org/frontend, org/backend-api]` for features that span repositories.
- **Rollback workflow** — Chain a `rollback` workflow that fires if post-merge monitoring detects regressions.

---

**Previous**: [← Spec Generation from Backlog](./03-spec-from-backlog.md)  
**Next**: [Multi-Repo Audit with Custom Overlays →](./05-multi-repo-audit-overlays.md)
