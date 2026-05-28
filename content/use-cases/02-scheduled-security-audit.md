# Use Case: Scheduled Security Audit

> **Complexity**: Intermediate  
> **Trigger**: Daily cron schedule  
> **Deliverable**: CVE findings report, optional Jira tickets for high-severity issues

---

## Goal

Keep your dependency security posture visible without manual effort. Every night Xema scans configured repositories for known CVEs, aggregates findings by severity, and emits a report. High-severity findings automatically open Jira issues assigned to the relevant team.

---

## Trigger

A cron schedule fires at `00:02 UTC` every day. No external webhook needed.

---

## Steps

| Step | Type | Description |
|---|---|---|
| `scan-repos` | Agent action (parallel fan-out) | Runs a CVE audit per repository; each job is independent |
| `aggregate` | Agent action | Merges per-repo results into a unified findings document |
| `notify` | Agent action | Summarises the report and sends a Slack digest to `#security-alerts` |
| `open-tickets` | HTTP action (conditional) | Creates Jira issues for any `critical` or `high` CVEs found |

---

## Deliverables

- **`cve-findings-report`** — Full severity-ranked list of vulnerabilities across all scanned repos. Stored as a versioned artifact.
- **Jira issues** — One per high/critical CVE, linked to the affected repo and component.
- **Slack message** — Digest summary posted to the security channel.

---

## Workflow YAML

```yaml
apiVersion: workflow/v1alpha1
kind: Workflow
metadata:
  name: scheduled-security-audit
  version: "1.0.0"

on:
  schedule:
    cron: "2 0 * * *"
    timezone: UTC

inputs:
  repositories:
    type: array
    default:
      - org/frontend
      - org/backend-api
      - org/infra-scripts
  severityThreshold:
    type: string
    default: high

jobs:
  scan-repos:
    strategy:
      matrix:
        repo: "{{ inputs.repositories }}"
    action: platform.agent@1.0.0
    input:
      task: |
        Run a CVE audit for the repository {{ matrix.repo }}.
        Identify all dependency vulnerabilities. For each finding include:
        CVE ID, severity, affected package, installed version, fixed version.
      deliverableSpec: cve-findings-v1
    output:
      artifactKey: "scan-{{ matrix.repo | slugify }}"

  aggregate:
    needs: [scan-repos]
    action: platform.agent@1.0.0
    input:
      task: |
        Aggregate the per-repository CVE scan results below into a single findings report.
        Group by severity (critical, high, medium, low). Deduplicate CVEs that appear in
        multiple repos. Produce a structured markdown report.
      context:
        scanResults: "{{ jobs.scan-repos.outputs }}"
      deliverableSpec: cve-findings-report-v1
    output:
      artifactKey: cve-findings-report

  notify:
    needs: [aggregate]
    action: biomes.slack-notifier.post-message@1.0.0
    input:
      channelId: "{{ env.SECURITY_SLACK_CHANNEL }}"
      message: |
        *Daily CVE Audit — {{ now | date: '%Y-%m-%d' }}*
        {{ jobs.aggregate.outputs.artifact.summary }}
        Full report: {{ jobs.aggregate.outputs.artifact.url }}

  open-tickets:
    needs: [aggregate]
    if: "{{ jobs.aggregate.outputs.criticalCount > 0 or jobs.aggregate.outputs.highCount > 0 }}"
    strategy:
      matrix:
        finding: "{{ jobs.aggregate.outputs.highSeverityFindings }}"
    action: platform.agent@1.0.0
    input:
      task: |
        Create a Jira issue for the following CVE finding.
        Project: SECURITY. Issue type: Bug. Priority: High.
        Title: "[CVE] {{ matrix.finding.cveId }} in {{ matrix.finding.package }} ({{ matrix.finding.repo }})"
        Description: include CVE ID, severity, affected package, installed vs fixed version, and recommended action.
      context:
        finding: "{{ matrix.finding }}"
```

---

## Extending It

- **Slack thread replies** — Post per-repo scan results as thread replies under the main digest.
- **Approval gate before Jira creation** — Wrap `open-tickets` in a `gate.humanApproval` so a security lead approves ticket creation.
- **Custom deliverable spec** — Create a `cve-findings-v1` spec with a strict JSON schema to enforce structured output you can query programmatically.
- **SARIF export** — Add a step that converts findings to SARIF format and uploads to GitHub Security tab.

---

**Previous**: [← Automated PR Review Comment](./01-automated-pr-review.md)  
**Next**: [Spec Generation from Backlog →](./03-spec-from-backlog.md)
