# Templates System

> API Docs: https://workflow-engine-api.xema.dev/api/docs

This document explains how templates work in Xema Workflows, including prompt templates, deliverable specs, and customization.

## Table of Contents

1. [Overview](#overview)
2. [Template Types](#template-types)
3. [Prompt Templates](#prompt-templates)
4. [Deliverable Specs](#deliverable-specs)
5. [Template Rendering](#template-rendering)
6. [Handlebars Syntax](#handlebars-syntax)
7. [Customization](#customization)
8. [Registry & Discovery](#registry--discovery)

---

## Overview

### What Are Templates?

Templates are **reusable specifications** that standardize how workflows generate deliverables:

- **Consistency** — Same structure across projects
- **Customization** — Adapt content to context
- **Reusability** — Share templates across teams
- **Maintainability** — Update once, everywhere updates

### Template Layers

```
User Input / Trigger
       ↓
Template Selection
       ↓
Context Binding
       ↓
Template Rendering (Handlebars)
       ↓
Final Output (Spec, Report, etc.)
```

---

## Template Types

### 1. Prompt Templates

System prompts that guide LLM agents:

**Purpose**: Provide role-specific instructions for agents  
**Format**: Markdown with embedded logic  
**Rendering**: Handlebars templating  
**Used by**: Agent invocation jobs  

**Key Templates**:
- `agents-md.builder` — Create specifications
- `agents-md.gate-reviewer` — Review phase outputs
- `agents-md.clarification-coordinator` — Handle clarifications
- `agents-md.interactive` — Interactive session guide

**Example**:
```markdown
# Role: Requirements Analyst

You are {{role}} for the {{organization}} project.

## Your Task
Analyze the following {{domain}} and create a detailed specification:

{{requirements}}

## Standards to Follow
{{#each standards}}
- {{this.name}}: {{this.description}}
{{/each}}

## Context
- Project Name: {{projectName}}
- Budget: ${{budget}}
- Timeline: {{timeline}}
```

### 2. Deliverable Specs Templates

Structured templates for deliverables (specifications, reports, plans):

**Purpose**: Standard document structure  
**Format**: Markdown with sections and placeholders  
**Rendering**: Handlebars + embedded logic  
**Used by**: Phase workflows  

**Examples**:
- Requirements specification
- Architecture design document
- Delivery plan
- Governance report
- Implementation report

**Structure**:
```
specs/
├── enterprise/
│   ├── requirements-enterprise/
│   │   ├── content.md            # Main template
│   │   └── pages/
│   │       ├── overview.md
│   │       ├── requirements.md
│   │       └── acceptance.md
│   ├── architecture-enterprise/
│   └── ...
├── complex/
│   ├── requirements-complex/
│   └── ...
└── simple/
    └── ...
```

**Example Spec**:
```markdown
# {{projectName}} Requirements Specification

## Overview
{{overview}}

## Functional Requirements
{{#each functionalRequirements}}
### {{this.id}} - {{this.title}}
**Priority**: {{this.priority}}  
**Description**: {{this.description}}  
**Acceptance Criteria**:
{{#each this.acceptanceCriteria}}
- {{this}}
{{/each}}
{{/each}}

## Non-Functional Requirements
{{nfr_reliability}}
{{nfr_performance}}
{{nfr_security}}

## Dependencies
{{#each dependencies}}
- {{this}}
{{/each}}

## Success Criteria
{{successCriteria}}

---
**Prepared by**: {{preparedBy}}  
**Date**: {{date}}  
**Version**: {{version}}
```

### 3. Session Templates

Reusable session configurations:

**Purpose**: Standard session setup  
**Format**: JSON configuration  
**Used by**: Interactive session jobs  

**Example**:
```json
{
  "name": "requirements-gathering",
  "type": "interactive",
  "tools": [
    "code-editor",
    "browser",
    "diagrams",
    "notes"
  ],
  "participants": ["user"],
  "context": {
    "role": "requirements-engineer",
    "phase": "requirements"
  }
}
```

---

## Prompt Templates

### Template Keys (Enum)

Available system prompt templates:

| Key | Purpose | Used When |
|-----|---------|-----------|
| `agents-md.builder` | Create deliverables | Agent builds specs/plans |
| `agents-md.gate-reviewer` | Review phase outputs | Gate review (automated) |
| `agents-md.clarification-coordinator` | Handle clarifications | Clarification phase |
| `agents-md.scope-validator` | Validate scope | Scope validation |
| `agents-md.interactive` | Interactive session | Chat/collaboration |

### Template Context

When rendering a template, provide context:

```typescript
interface PromptContext {
  role: string                          // Agent role (e.g. unit-worker, coordinator, gate-reviewer)
  phase: string                        // Current phase (requirements, architecture, etc.)
  spec: {
    title: string
    standards: string[]                 // e.g., ["ISO/IEC 25010", "TOGAF"]
    guidelines: string
  }
  projectName: string
  organization: string
  hasRetryContext: boolean             // Has this been retried?
  retryFeedback?: string               // Feedback from previous attempt
  domain: string                       // Domain (backend, frontend, data, etc.)
}
```

### Rendering Example

```yaml
jobs:
  build-spec:
    uses: xema/agent
    with:
      task: Build comprehensive requirements specification
      systemPrompt: ${{ templates.render('agents-md.builder', context) }}
      context:
        role: requirements-analyst
        phase: requirements
        spec:
          title: Enterprise Requirements
          standards: [ISO/IEC 25010, MoSCoW]
        projectName: Acme Portal
        organization: Acme Corp
```

---

## Deliverable Specs

### Spec Categories

Specs vary by **complexity** and **type**:

#### Complexity Levels
- **simple** — Minimal structure, quick generation
- **complex** — Full sections, comprehensive coverage
- **enterprise** — Complete with governance, security, compliance

#### Types
- `requirements-*` — Requirement specifications
- `architecture-*` — Architecture design
- `delivery-plan-*` — Implementation roadmap
- `governance-*` — Quality & compliance
- `implementation-*` — Development report

### Selecting a Template

In workflow:

```yaml
jobs:
  create-requirements:
    uses: xema/agent
    with:
      template: requirements-enterprise    # Select template
      task: Create detailed requirements
      context: ${{ inputs.scope }}
```

### Template Sections

Deliverable specs include standard sections:

#### Requirements Spec Sections
1. **Overview** — High-level summary
2. **Functional Requirements** — What the system does
3. **Non-Functional Requirements** — Performance, security, etc.
4. **Dependencies** — External systems
5. **Success Criteria** — How to measure success
6. **Assumptions** — Underlying assumptions
7. **Constraints** — Limitations and boundaries

#### Architecture Spec Sections
1. **System Overview** — Big picture
2. **Architecture Layers** — Component organization
3. **Technology Stack** — Tools and frameworks
4. **Data Model** — Entity relationships
5. **Integration Points** — External systems
6. **Security Architecture** — Security design
7. **Scalability Plan** — Growth considerations

---

## Template Rendering

### Handlebars Syntax

Templates use **Handlebars** for dynamic content:

```handlebars
{{variable}}              → Substitute variable

{{#if condition}}         → Conditional block
  Content
{{/if}}

{{#unless condition}}     → Negation
  Content
{{/unless}}

{{#each array}}           → Loop over array
  Item: {{this}}
{{/each}}

{{#with object}}          → Change context
  {{property}}
{{/with}}

{{../parent.value}}       → Access parent context

{{variable | uppercase}}  → Helper functions
```

### Common Helpers

#### Built-in Helpers

- `if` — Conditional rendering
- `each` — Loop iteration
- `with` — Context change
- `unless` — Negation

#### Custom Helpers

Available custom helpers:

```handlebars
{{and condition1 condition2}}      → Logical AND
{{cond condition yes no}}          → Ternary operator
{{includes array item}}            → Array membership
{{equals a b}}                     → Equality check
```

### Template Examples

#### Example 1: Conditional Sections

```handlebars
# Requirements Specification

{{#if includeExecutiveSummary}}
## Executive Summary
{{executiveSummary}}
{{/if}}

{{#each requirements}}
### {{this.id}}: {{this.title}}
Priority: {{this.priority}}
{{#if this.optional}}
*This is an optional requirement*
{{/if}}
{{/each}}
```

#### Example 2: Nested Loops

```handlebars
# Architecture Design

{{#each architectureLayers}}
## {{this.name}}

{{#each this.components}}
### {{this.componentName}}
- Technology: {{this.technology}}
- Responsibility: {{this.responsibility}}

{{#if this.dependencies}}
**Dependencies:**
{{#each this.dependencies}}
- {{this}}
{{/each}}
{{/if}}

{{/each}}

{{/each}}
```

#### Example 3: Context Switching

```handlebars
# Project Details

{{#with project}}
**Name**: {{name}}
**Owner**: {{owner}}

## Team Members

{{#each team}}
- {{this.name}} ({{this.role}})
{{/each}}

{{/with}}
```

---

## Customization

### Creating Custom Templates

Define custom templates for your organization:

```markdown
# Custom Template: Acme Requirements Spec

## Project Information
- Name: {{projectName}}
- Organization: {{organization}}
- Budget: ${{budget}}

## Requirements by Category

{{#each requirementsByCategory}}
### {{@key | capitalize}}

{{#each this}}
1. **{{id}}** - {{title}}
   - Priority: {{priority}}
   - Effort: {{estimatedDays}} days
   - Owner: {{owner}}
{{/each}}

{{/each}}

## Quality Standards
- All requirements must be SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
- All must have acceptance criteria
- All must be traceable to business goals

---
**Prepared by**: {{preparedBy}}
**Date**: {{date}}
**Status**: {{status}}
```

### Template Versioning

Templates are versioned:

```yaml
metadata:
  name: requirements-spec
  version: 2.1.0
  lastUpdated: 2026-04-27
  author: platform-team
```

Changes are tracked; old versions remain available.

### Template Localization

Support multiple languages:

```
specs/
├── en/
│   ├── requirements-enterprise/
│   └── ...
├── es/
│   ├── requirements-enterprise/
│   └── ...
└── fr/
    └── ...
```

Select language at render time:

```yaml
with:
  template: requirements-enterprise
  language: ${{ inputs.language }}
```

---

## Registry & Discovery

### Template Registry

The **Template Registry** is a centralized catalog:

```typescript
class TemplateRegistry {
  register(entry: TemplateEntry): void
  require(key: string): TemplateEntry     // Fail if missing
  get(key: string): TemplateEntry | undefined
  has(key: string): boolean
  list(): readonly TemplateEntry[]
}
```

### Discovering Available Templates

List available templates:

```bash
curl https://deliverable-specs-api.xema.dev/deliverable-specs \
  -H "Authorization: Bearer $TOKEN"
```

Response:
```json
{
  "templates": [
    {
      "key": "agents-md.builder",
      "name": "Agent Builder Prompt",
      "type": "prompt",
      "description": "System prompt for builder agents"
    },
    {
      "key": "requirements-enterprise",
      "name": "Enterprise Requirements Spec",
      "type": "deliverable",
      "complexity": "enterprise",
      "description": "Full requirements specification for enterprise projects"
    }
  ]
}
```

### Searching Templates

```bash
curl https://deliverable-specs-api.xema.dev/deliverable-specs \
  ?type=deliverable \
  ?complexity=enterprise \
  -H "Authorization: Bearer $TOKEN"
```

---

## Template Best Practices

### 1. Use Clear Variable Names

Good:
```handlebars
{{projectName}}
{{functionalRequirements}}
```

Bad:
```handlebars
{{pn}}
{{fr}}
```

### 2. Provide Defaults

```handlebars
{{projectName | default "Untitled Project"}}
{{preparedBy | default "Unknown"}}
```

### 3. Document Required Fields

In template header:
```handlebars
<!-- REQUIRED FIELDS:
  - projectName: string
  - functionalRequirements: array
  - budget: number
  - timeline: string
-->
```

### 4. Use Semantic Structure

```handlebars
# Heading 1 (Use once per document)
## Heading 2 (Main sections)
### Heading 3 (Subsections)

**Bold** for emphasis
*Italic* for references
```

### 5. Handle Optional Sections

```handlebars
{{#if includeOptionalSection}}
## Optional Section
{{optionalContent}}
{{/if}}
```

### 6. Escape Special Characters

```handlebars
<!-- For literal braces, use HTML entities -->
{{variable}}

<!-- For ampersands in content -->
&amp; instead of &
```

---

## Examples

### Example 1: Requirements Spec Template (Enterprise)

```handlebars
# {{projectName}} Requirements Specification

**Version**: {{version}}  
**Date**: {{date}}  
**Prepared By**: {{preparedBy}}  

## Overview

{{overview}}

### Business Objectives
{{#each businessObjectives}}
1. {{this}}
{{/each}}

### Key Stakeholders
{{#each stakeholders}}
- {{this.name}} ({{this.role}})
{{/each}}

## Functional Requirements

{{#each functionalRequirements}}
### FR-{{this.id}}: {{this.title}}

**Priority**: {{this.priority}}  
**Complexity**: {{this.complexity}}  
**Estimated Effort**: {{this.estimatedDays}} days

**Description**:  
{{this.description}}

**Acceptance Criteria**:
{{#each this.acceptanceCriteria}}
- [ ] {{this}}
{{/each}}

{{#if this.dependencies}}
**Dependencies**: {{#each this.dependencies}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

{{/each}}

## Non-Functional Requirements

### Performance
{{nfr.performance}}

### Security
{{nfr.security}}

### Scalability
{{nfr.scalability}}

### Usability
{{nfr.usability}}

## Constraints & Assumptions

**Constraints**:
{{#each constraints}}
- {{this}}
{{/each}}

**Assumptions**:
{{#each assumptions}}
- {{this}}
{{/each}}

## Success Criteria

{{successCriteria}}

---
**Approved By**: {{approver}}  
**Approval Date**: {{approvalDate}}
```

### Example 2: Agent Prompt Template

```handlebars
# Role: {{role | capitalize}}

You are a {{role}} for the {{organization}} project.

## Context
- **Project**: {{projectName}}
- **Phase**: {{phase | capitalize}}
- **Complexity**: {{complexity}}
- **Timeline**: {{timeline}}

## Task

{{task}}

## Guidelines

{{#each guidelines}}
- {{this}}
{{/each}}

## Standards & Best Practices

{{#each standards}}
### {{@index | plus 1}}. {{this.name}}
{{this.description}}

{{#each this.practices}}
- {{this}}
{{/each}}

{{/each}}

## Success Criteria

Your output will be evaluated on:
1. {{successCriteria.first}}
2. {{successCriteria.second}}
3. {{successCriteria.third}}

## Format

Please structure your response as follows:
- Use clear headings (##, ###, ####)
- Use bullet points for lists
- Use code blocks for technical content
- Use tables for structured data
- Include explanations for all recommendations

---
{{#if hasRetryContext}}
**Note**: This is a retry. Consider the previous feedback:
{{retryFeedback}}
{{/if}}
```

---

**Next**: Read [API Reference](./07-api-reference.md) for REST endpoints.
