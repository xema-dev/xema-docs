# Use Case: Multi-Repo Audit with Custom Overlays

> **Complexity**: Advanced  
> **Trigger**: Manual dispatch or weekly schedule  
> **Deliverables**: Per-repo audit report, consolidated findings, team-specific deliverables shaped by overlays

---

## Goal

Run a consistent audit across many repositories while allowing each team to customise the output format, depth, and criteria through **deliverable spec overlays**. A shared base spec defines the common audit structure; overlays add team-specific requirements (e.g. frontend teams get accessibility checks, backend teams get OWASP checks, infra teams get IaC policy checks).

This demonstrates Xema's overlay system at scale — the most sophisticated use of the templates and deliverable specs feature.

---

## Trigger

Weekly cron schedule (`Monday 06:00 UTC`) or manual dispatch with an optional `targetTeam` filter.

---

## Architecture

```
Base Spec: repo-audit-v1
    │
    ├── overlays/frontend-audit   → adds accessibility + bundle-size criteria
    ├── overlays/backend-audit    → adds OWASP Top 10 + API contract checks
    └── overlays/infra-audit      → adds IaC policy + secret-scanning criteria

For each repo:
  1. Resolve effective spec = base spec + team overlay
  2. Run agent audit against effective spec
  3. Emit per-repo artifact

Aggregate:
  1. Merge per-repo artifacts
  2. Produce consolidated findings report
  3. Post Slack digest
```

---

## Steps

| Step | Type | Description |
|---|---|---|
| `resolve-repos` | Agent action | Fetches the list of repositories from the project registry, grouped by team |
| `audit-repo` (matrix) | Agent action (parallel) | Audits each repository using its team-specific overlay |
| `aggregate` | Agent action | Merges all per-repo results into a consolidated report |
| `post-digest` | HTTP action | Posts a Slack digest to each team channel |
| `open-tickets` (conditional) | Agent action | Creates Jira issues for critical findings per team |

---

## Deliverables

- **Per-repo `repo-audit-<slug>`** — Individual audit report shaped by the team's overlay. Stored as a versioned artifact.
- **`consolidated-audit-report`** — Organisation-wide view. Top-level findings, team summaries, trend data.
- **Jira issues** — One per critical finding per team, assigned to the team lead.

---

## Workflow YAML

```yaml
apiVersion: workflow/v1alpha1
kind: Workflow
metadata:
  name: multi-repo-audit-overlays
  version: "1.0.0"

on:
  schedule:
    cron: "0 6 * * 1"
    timezone: UTC
  manual:
    inputs:
      - name: targetTeam
        type: string
        required: false
        description: "Filter to a specific team (frontend, backend, infra). Omit for all teams."

inputs:
  targetTeam:
    type: string
    source: "{{ trigger.inputs.targetTeam | default: '' }}"

jobs:
  resolve-repos:
    action: platform.agent@1.0.0
    input:
      task: |
        Fetch all active repositories from the project registry.
        For each repository, determine the owning team (frontend, backend, infra, other)
        and the appropriate deliverable spec overlay.
        Filter to team {{ inputs.targetTeam }} if specified.
        Return a list of objects: { repo, team, overlayId }.
      context:
        targetTeam: "{{ inputs.targetTeam }}"
    output:
      artifactKey: repo-list

  audit-repo:
    needs: [resolve-repos]
    strategy:
      matrix:
        entry: "{{ jobs.resolve-repos.outputs.artifact.repos }}"
      maxConcurrency: 5
    action: platform.agent@1.0.0
    input:
      task: |
        Perform a comprehensive code audit of the repository {{ matrix.entry.repo }}.
        Use the deliverable spec overlay {{ matrix.entry.overlayId }} (extends repo-audit-v1).
        Assess: code quality, security posture, dependency health, test coverage,
        documentation completeness, and any overlay-specific criteria.
        Produce a structured audit report.
      context:
        repo: "{{ matrix.entry.repo }}"
        team: "{{ matrix.entry.team }}"
      deliverableSpec: repo-audit-v1
      deliverableSpecOverlay: "{{ matrix.entry.overlayId }}"
    output:
      artifactKey: "audit-{{ matrix.entry.repo | slugify }}"

  aggregate:
    needs: [audit-repo]
    action: platform.agent@1.0.0
    input:
      task: |
        Merge all per-repository audit reports into a consolidated organisation-wide
        audit report. Structure by team. Highlight: top critical findings, most
        improved repos, most regressed repos, and overall health score trend.
        Compare to previous week's report if available.
      context:
        auditResults: "{{ jobs.audit-repo.outputs }}"
      deliverableSpec: consolidated-audit-report-v1
    output:
      artifactKey: consolidated-audit-report

  post-digest:
    needs: [aggregate]
    strategy:
      matrix:
        team: [frontend, backend, infra]
    action: biomes.slack-notifier.post-message@1.0.0
    input:
      channelId: "{{ env['TEAM_SLACK_CHANNEL_' + matrix.team | upper] }}"
      message: |
        *Weekly Repo Audit — {{ now | date: '%Y-%m-%d' }} — {{ matrix.team | capitalize }} Team*
        {{ jobs.aggregate.outputs.artifact.teamSummaries[matrix.team] }}
        Full report: {{ jobs.aggregate.outputs.artifact.url }}

  open-tickets:
    needs: [aggregate]
    if: "{{ jobs.aggregate.outputs.criticalFindingsCount > 0 }}"
    strategy:
      matrix:
        finding: "{{ jobs.aggregate.outputs.criticalFindings }}"
    action: platform.agent@1.0.0
    input:
      task: |
        Create a Jira issue for the critical finding below.
        Project: OPS. Issue type: Bug. Priority: Critical.
        Assign to the team lead of team {{ matrix.finding.team }}.
        Include: repo, file/area, finding description, recommended remediation.
      context:
        finding: "{{ matrix.finding }}"
```

---

## Defining Overlays

Overlays are managed through the `deliverable-specs-api`. An overlay extends a base spec by adding or overriding criteria sections.

Example: `overlays/backend-audit` overlay definition:

```yaml
apiVersion: deliverable-spec/v1alpha1
kind: Overlay
metadata:
  id: backend-audit
  extends: repo-audit-v1

additions:
  sections:
    - id: owasp-checks
      title: "OWASP Top 10 Assessment"
      required: true
      schema:
        type: object
        properties:
          injectionRisks:
            type: string
          authenticationFlaws:
            type: string
          sensitiveDataExposure:
            type: string
          securityMisconfiguration:
            type: string
          overallOwaspScore:
            type: string
            enum: [pass, warn, fail]
        required: [overallOwaspScore]

    - id: api-contract-health
      title: "API Contract Health"
      required: true
      schema:
        type: object
        properties:
          openApiSpecPresent:
            type: boolean
          breakingChangesDetected:
            type: boolean
          clientGenerationPassing:
            type: boolean
```

See the [Overlays documentation](../templates/03-overlays.md) for the full overlay DSL reference.

---

## Extending It

- **Historical trending** — Store consolidated reports in a time-series artifact store and compare week-over-week health scores.
- **Score-based gate** — Block the pipeline if the organisation-wide health score drops below a threshold.
- **Per-repo drill-down sessions** — For repos with critical findings, automatically launch an interactive engineering session to remediate.
- **External report export** — Add a step that renders the consolidated report as a PDF and emails it to engineering leadership.
- **Dynamic overlay selection** — Derive the overlay ID from repo metadata (language, stack, compliance tier) rather than hardcoding team names.

---

**Previous**: [← Feature Lifecycle Pipeline](./04-feature-lifecycle.md)  
**Back to index**: [Use Cases Overview](./index.md)
