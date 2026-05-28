# Xema Workflows Documentation

> API Docs: https://workflow-engine-api.xema.dev/api/docs

Welcome to the Xema Workflows documentation. This guide explains how workflows power the Xema platform, enabling automated, intelligent, and human-guided software delivery pipelines.

## What Are Workflows?

Workflows are **declarative, YAML-based automation specifications** that orchestrate multi-stage software delivery processes. They combine:

- **Deterministic execution** — Same workflow + input always produces the same output
- **Intelligent automation** — LLM agents, human approval gates, and artifact review
- **Flexible integration** — Connect external systems (GitHub, GitLab, Jira, Slack, etc.)
- **Production-grade reliability** — Built on the Xema Workflow Runtime for fault-tolerant, long-running processes

## Key Capabilities

| Capability | What You Can Do |
|------------|-----------------|
| **Multi-phase pipelines** | Orchestrate 8+ coordinated phases from requirements through deployment |
| **Intelligent gates** | Automated agent-powered quality reviews + human approval workflows |
| **Dynamic expansion** | Matrix jobs and runtime-driven parallelization |
| **Smart templating** | Handlebars-based templates for consistent deliverables |
| **Data flow** | Typed inputs, outputs, and expressions for data passing |
| **External integrations** | Trigger workflows from GitHub, GitLab, Jira, Slack, and custom webhooks |
| **Human collaboration** | Built-in approval gates with quorum-based voting |
| **Artifact production** | Generate and version specifications, reports, and deliverables |
| **Workspace manifests** | Declare the full agent environment (repos, KB, seed files) via a named manifest or inline mounts |

## Quick Links

- **[Concepts & Fundamentals](./01-concepts.md)** — DSL, templates, phases, artifacts
- **[Features & Capabilities](./02-features.md)** — Available workflow features and when to use them
- **[Integration Guide](./05-integration-guide.md)** — How external systems trigger and interact with workflows
- **[Templates System](./06-templates-guide.md)** — How templates work and how to customize them
- **[Expressions & Data Flow](./03-expressions.md)** — Inputs, outputs, variable binding, and expressions
- **[API Reference](./07-api-reference.md)** — REST API endpoints for workflow management
- **[Briefcase](./08-briefcase.md)** — Attach run-scoped context (files, references, vars, tools) at dispatch
- **[Workspace Manifests](../workspace-manifests/index.md)** — Author and manage workspace manifests for agent jobs

## For Different Audiences

### Product Managers & Business Users
Start with [Features & Capabilities](./02-features.md) to understand what workflows enable for your product. Then read [Integration Guide](./05-integration-guide.md) to see how users interact with external systems.

### Developers & Technical Integrators
Begin with [Concepts & Fundamentals](./01-concepts.md) to understand DSL structure. Then explore [Integration Guide](./05-integration-guide.md) and [Expressions & Data Flow](./03-expressions.md) for technical implementation details.

### DevOps & Platform Engineers
See [Concepts & Fundamentals](./01-concepts.md) for architecture overview, then review the execution model and workflow runtime configuration sections.

## Core Principles

1. **Declarative, not imperative** — You describe *what* should happen; Xema handles *how*
2. **Type-safe and fail-fast** — Invalid workflows are rejected at compile time, not runtime
3. **Deterministic & reproducible** — Same inputs always produce identical execution plans
4. **Single ingress edge** — All external webhooks flow through a normalized integration layer
5. **Human-in-the-loop** — Approval gates and human review are first-class features
6. **Scalable** — Built on the Xema Workflow Runtime for horizontal scaling and fault tolerance

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Workflow Authoring Layer                                   │
│  (YAML DSL v1alpha1)                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Compilation Layer                                          │
│  (Validation, Action Pinning, Job DAG)                     │
│  ↓ Produces deterministic CompiledRun                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Dispatch & Trigger Layer                                   │
│  (Webhook, Schedule, Manual)                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Execution Engine (Xema Workflow Runtime)                    │
│  (Job Scheduling, Approval Gates, Agent Invocation)        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Activity Runtime                                           │
│  (Agent Execution, Artifact Emission, Reviews)              │
└─────────────────────────────────────────────────────────────┘

External Systems ──┐
(GitHub, GitLab,   ├──> Integration Adapters ──> Webhook Dispatcher
 Jira, Slack, ...) └────────────────────────────────> Workflow Trigger
```

## Getting Started

1. **Read [Concepts & Fundamentals](./01-concepts.md)** to understand workflow structure
2. **Review [Features & Capabilities](./02-features.md)** to decide which features you need
3. **Check [Integration Guide](./05-integration-guide.md)** to understand how your system interacts
4. **Explore [Expressions & Data Flow](./03-expressions.md)** to learn about inputs/outputs
5. **Customize [Templates](./06-templates-guide.md)** for your deliverables

## FAQ

**Q: Can I use workflows without coding?**  
A: Yes! Workflows are YAML-based and declarative. You describe what you want to happen, and Xema handles the implementation. No code required.

**Q: How do I trigger workflows from external systems?**  
A: See [Integration Guide](./05-integration-guide.md). Workflows can be triggered by webhooks from GitHub, GitLab, Jira, Slack, and any system that can send HTTP POST requests.

**Q: What if a workflow fails?**  
A: Workflows are built on the Xema Workflow Runtime, which provides automatic retry logic, failure handling, and human intervention options. See [Features & Capabilities](./02-features.md) for details.

**Q: How long can workflows run?**  
A: Xema workflows can run for months or years. Long-running workflows (human approvals, multi-phase pipelines) are fully supported.

**Q: Can workflows call other workflows?**  
A: Yes! Workflows can call other workflows as child workflows, enabling complex hierarchical automation.

## Need Help?

- **Technical issues** — Check the [API Reference](./07-api-reference.md)
- **Integration questions** — See [Integration Guide](./05-integration-guide.md)
- **Template customization** — Review [Templates System](./06-templates-guide.md)
- **Expression syntax** — Explore [Expressions & Data Flow](./03-expressions.md)

---

**Last Updated**: April 2026  
**Version**: 1.0 — Xema Workflows System
