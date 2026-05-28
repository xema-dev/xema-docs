# Workflows & DSL Documentation

> API Docs: https://docs-api.xema.dev/api/docs

This directory contains comprehensive technical documentation for Xema Workflows and the Workflow DSL, designed for developers, non-developers, product managers, and platform engineers.

## 📚 Documentation Structure

### `/workflows/` — Workflows Feature Documentation

Main workflows documentation covering features, integration, and concepts:

- **[index.md](./workflows/index.md)** — Overview and navigation
- **[concepts.md](./workflows/concepts.md)** — Core concepts (DSL, compilation, templates, phases)
- **[features.md](./workflows/features.md)** — All available features and capabilities
- **[integration-guide.md](./workflows/integration-guide.md)** — External system integration patterns
- **[expressions.md](./workflows/expressions.md)** — Inputs, outputs, data flow, and expressions
- **[templates-guide.md](./workflows/templates-guide.md)** — Template system and customization
- **[api-reference.md](./workflows/api-reference.md)** — REST API endpoints

### `/dsl/` — Domain-Specific Language Reference

Complete DSL specification and language guide:

- **[index.md](./dsl/index.md)** — DSL overview and quick start
- **[reference.md](./dsl/reference.md)** — Complete syntax specification
- **[examples.md](./dsl/examples.md)** — Real-world workflow examples
- **[best-practices.md](./dsl/best-practices.md)** — Conventions and guidelines
- **[troubleshooting.md](./dsl/troubleshooting.md)** — Debugging and common issues

## 🎯 Where to Start

### For Product Managers & Business Users
1. Start with [Workflows: Features & Capabilities](./workflows/features.md) to understand what's possible
2. Read [Integration Guide](./workflows/integration-guide.md) to see how external systems connect

### For Developers & Technical Integrators
1. Begin with [Concepts & Fundamentals](./workflows/concepts.md) for architecture overview
2. Learn the DSL with [Language Reference](./dsl/reference.md) and [Examples](./dsl/examples.md)
3. Dive into [Integration Guide](./workflows/integration-guide.md) and [Expressions](./workflows/expressions.md)

### For DevOps & Platform Engineers
1. Read [Concepts](./workflows/concepts.md) for architecture and execution model
2. Reference [DSL Specification](./dsl/reference.md) for validation requirements
3. Check [Best Practices](./dsl/best-practices.md) for operational guidelines

### For Anyone Building Workflows
1. Quick start with [DSL Overview](./dsl/index.md)
2. Find patterns in [Examples](./dsl/examples.md)
3. Follow [Best Practices](./dsl/best-practices.md)
4. Use [Troubleshooting](./dsl/troubleshooting.md) when needed

## 📖 Documentation Map

```
Workflows
├── Index (Overview & Quick Links)
├── Concepts
│   ├── What is a workflow?
│   ├── DSL structure
│   ├── Compilation model
│   ├── Templates
│   ├── Phases & artifacts
│   └── Execution model
├── Features
│   ├── Multi-phase pipelines
│   ├── Intelligent execution (agents)
│   ├── Human collaboration (approvals)
│   ├── Dynamic expansion (matrix)
│   ├── Data flow
│   ├── Error handling
│   ├── Concurrency control
│   ├── Timeouts & deadlines
│   ├── Conditional execution
│   ├── Artifact management
│   ├── Webhooks & triggers
│   └── Permission-based access
├── Integration Guide
│   ├── Single ingress edge architecture
│   ├── Webhook triggers
│   ├── Supported providers
│   ├── Payload formats
│   ├── Workflow dispatch API
│   ├── External actions
│   └── Integration patterns
├── Expressions & Data Flow
│   ├── Inputs
│   ├── Variables
│   ├── Outputs
│   ├── Expression syntax
│   └── Context & scope
├── Templates System
│   ├── Template types
│   ├── Prompt templates
│   ├── Deliverable specs
│   ├── Handlebars rendering
│   ├── Customization
│   └── Template registry
└── API Reference
    ├── Authentication
    ├── Workflow management
    ├── Workflow execution
    ├── Artifact management
    └── Template APIs

DSL
├── Index (Quick Start)
├── Language Reference
│   ├── Root properties
│   ├── Metadata
│   ├── Triggers
│   ├── Concurrency
│   ├── Defaults & permissions
│   ├── Jobs
│   └── Expressions
├── Examples
│   ├── Simple workflows
│   ├── Multi-stage pipelines
│   ├── Approval workflows
│   ├── Integration patterns
│   ├── Dynamic workflows
│   └── Error handling
├── Best Practices
│   ├── Naming conventions
│   ├── Structure & organization
│   ├── Type safety
│   ├── Error handling
│   ├── Performance
│   ├── Security
│   ├── Maintainability
│   └── Testing
└── Troubleshooting
    ├── Workflow won't start
    ├── Compilation errors
    ├── Job failures
    ├── Expression errors
    ├── Data flow issues
    ├── Permission issues
    ├── Performance issues
    └── Getting help
```

## 🔑 Key Concepts

### Workflows
Declarative YAML-based automation specifications that:
- Are deterministic (same inputs = same execution)
- Are type-safe (validated at compile time)
- Support intelligent automation (LLM agents)
- Include human collaboration (approvals, reviews)
- Integrate with external systems (GitHub, Jira, Slack, etc.)
- Run on the Xema Workflow Runtime for fault tolerance

### DSL (Domain-Specific Language)
A YAML language designed for non-programmers to define workflows without coding:
- Simple, readable syntax
- Strong typing and validation
- Expression system for data flow
- Comprehensive feature set

### Templates
Reusable specifications for:
- **Prompt Templates** — System instructions for agents
- **Deliverable Specs** — Document/report templates
- **Session Templates** — Session configurations

### Phases
8 coordinated stages in software delivery:
1. Brainstorming
2. Clarification
3. Requirements
4. Architecture
5. Delivery Planning
6. Engineering
7. Governance
8. Deployment

### Integration
All external webhooks flow through a **single normalized adapter** ensuring:
- Consistent event handling
- Deterministic idempotency
- Single security boundary
- No direct webhook access to domain services

## 💡 Feature Highlights

✨ **Intelligent Execution** — LLM agents can analyze, generate, and review  
🔄 **Human Collaboration** — Built-in approval gates with quorum voting  
⚙️ **Flexible Triggers** — Webhooks, schedules, manual, workflow calls  
📊 **Dynamic Jobs** — Matrix expansion and runtime-driven parallelization  
🔐 **Type-Safe** — All inputs and outputs are validated  
🚀 **Production-Grade** — Xema Workflow Runtime-backed execution with fault tolerance  
🌐 **Open Integration** — Connect any external system via webhooks or APIs  
📦 **Artifact Management** — Version, track, and reuse deliverables  

## 🔗 Internal Linking

Documentation uses relative links for seamless navigation:
- Links follow structure: `./workflows/concepts.md`, `./dsl/examples.md`
- Cross-references between workflows and DSL documentation
- "Next" and "Previous" navigation between sections

## 📝 Documentation Standards

All documentation follows these principles:

1. **Clarity** — Written for both technical and non-technical audiences
2. **Examples** — Every concept includes practical examples
3. **Completeness** — Covers features, API, and troubleshooting
4. **Navigation** — Clear cross-references and table of contents
5. **Accuracy** — Based on actual implementation details
6. **Security** — No hardcoded secrets or internal intellectual property

## 🛠️ Using This Documentation

### For Reading
- Start at the index for your audience
- Follow "Next" links or use table of contents
- Use cross-references for deep dives
- Check examples for implementation patterns

### For Contributing
- Maintain structure and linking conventions
- Include practical examples
- Keep audience in mind
- Update tables of contents
- Add cross-references

### For Integration
Documentation is served by `docs-api`, supporting:
- Markdown rendering
- Relative link resolution
- Full-text search
- Version control

---

**Last Updated**: April 2026  
**Documentation Version**: 1.0  
**Status**: Complete and production-ready
