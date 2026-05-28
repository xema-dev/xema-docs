# Spec Overlays

> API Docs: https://deliverable-specs-api.xema.dev/api/docs

Overlays extend deliverable specs with additional requirements — without modifying the base spec. They enable a powerful **composition model**: one base spec, many variations by stack or concern.

## Why Overlays?

Consider a `requirements-standard` spec used by all teams. Some requirements vary:
- Teams building NestJS/Prisma services need database migration requirements
- Security-sensitive work needs threat model sections
- User-facing features need accessibility criteria

Instead of creating separate specs for each combination, overlays let you:
1. Keep a single base spec
2. Define overlays for each concern
3. Let the platform apply the right overlays automatically based on project tags

---

## Overlay Composition Model

```
Base Spec Content
        +
Overlay 1 Content (if tag matches)
        +
Overlay 2 Content (if tag matches)
        +
...
        =
Final spec delivered to agent
```

Overlay content is **appended** to the base spec. Overlays do not modify or replace base content — they add to it.

---

## Built-In Overlays

The platform ships these overlays out of the box:

| Tag | Category | Added Requirements |
|-----|----------|-------------------|
| `stack:nestjs-prisma` | stack | API endpoints, Prisma schema changes, DB migrations |
| `stack:nextjs-vercel` | stack | Next.js page changes, Vercel config, edge compatibility |
| `concern:security` | concern | Threat model, auth/authz, input validation, OWASP checklist |
| `concern:performance` | concern | Performance budgets, profiling guidance, caching strategy |
| `concern:accessibility` | concern | WCAG 2.1 compliance, ARIA, keyboard navigation, screen readers |

### How Built-In Overlays Are Applied

The platform automatically applies overlays when:
1. The project has matching stack/concern tags
2. A workflow explicitly declares overlays
3. An overlay binding is active for the org

---

## Tag System

### Tag Categories

Tags have two parts: `category:value`.

**Stack tags** (`stack:*`) — Technology stack the project uses:
- `stack:nestjs-prisma`
- `stack:nextjs-vercel`
- `stack:react-native`
- `stack:python-fastapi`
- Custom: any `stack:*` value your org defines

**Concern tags** (`concern:*`) — Cross-cutting concerns:
- `concern:security`
- `concern:performance`
- `concern:accessibility`
- `concern:compliance`
- Custom: any `concern:*` value your org defines

### Setting Project Tags

Project tags are configured in the Project Registry. When a workflow runs in a project tagged `stack:nestjs-prisma`, all overlays with that tag are automatically applied to specs used in that project.

---

## Creating Overlays

### Create an Overlay Binding

```bash
curl -X POST "https://deliverable-specs-api.xema.dev/deliverable-specs/{specId}/overlay-bindings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tagCategory": "stack",
    "tagValue": "nestjs-prisma",
    "content": "## NestJS/Prisma Implementation Requirements\n\n### API Endpoints\n...\n\n### Prisma Schema\n..."
  }'
```

### Overlay Content Examples

**NestJS/Prisma overlay** (appended to any spec with `stack:nestjs-prisma` match):

```markdown
## NestJS/Prisma Specific Requirements

### New API Endpoints

For each new endpoint, document:
- HTTP method and path (e.g., `POST /users/:id/activate`)
- Request DTO fields with validation rules
- Response DTO fields
- Authorization requirements
- Error response codes

### Prisma Schema Changes

List all new/modified Prisma models:
- New fields with types and constraints
- New relations and their cardinality
- Indexes required for query performance
- Migrations needed

### Database Migration Plan

- Describe any breaking schema changes
- Document rollback strategy for each migration
- Estimate migration duration for production data volumes
```

**Security concern overlay** (appended to any spec with `concern:security` match):

```markdown
## Security Requirements

### Threat Model

Identify threats for the feature:
- What assets are being protected?
- Who are the potential attackers?
- What are the attack vectors?
- What are the mitigations?

### Authentication & Authorization

- Which endpoints require authentication?
- What authorization rules apply?
- Are there any privilege escalation risks?

### Input Validation

- List all user inputs and their validation rules
- Note any inputs that reach database queries (SQL injection risk)
- Note any inputs that reach file paths (path traversal risk)

### OWASP Checklist

Confirm consideration of:
- [ ] Injection (SQL, command, LDAP)
- [ ] Broken Authentication
- [ ] Sensitive Data Exposure
- [ ] XML External Entities (XXE)
- [ ] Broken Access Control
- [ ] Security Misconfiguration
- [ ] Cross-Site Scripting (XSS)
- [ ] Insecure Deserialization
- [ ] Using Components with Known Vulnerabilities
- [ ] Insufficient Logging and Monitoring
```

---

## Force-Binding Overlays in Workflows

Explicitly apply overlays regardless of project tags:

```yaml
jobs:
  create-spec:
    uses: xema/agent
    with:
      deliverableSpecRef: requirements-standard@1.0.0
      overlays:
        - concern:security      # Always apply, even if not in project tags
        - concern:performance
```

Force-binding is useful when:
- A specific workflow always requires certain overlays (e.g., a "security review" workflow always needs `concern:security`)
- You're overriding the tag-based selection for a specific run
- You're testing an overlay without modifying project tags

---

## Overlay Scoping

Overlays can be scoped to apply globally (shared), per-org, or as org overrides:

| Scope | Description |
|-------|-------------|
| `shared` | Platform-level overlay, applies to all orgs |
| `org` | Org-specific overlay, applies within an org |
| `org_override` | Org override of a shared overlay (replaces shared content) |

When an org creates an `org_override` for a shared overlay tag, their content replaces the shared overlay content for that tag — rather than appending.

---

## Listing and Managing Overlays

```bash
# List overlay bindings for a spec
curl "https://deliverable-specs-api.xema.dev/deliverable-specs/{specId}/overlay-bindings" \
  -H "Authorization: Bearer $TOKEN"

# Get a specific overlay binding
curl "https://deliverable-specs-api.xema.dev/deliverable-specs/{specId}/overlay-bindings/{bindingId}" \
  -H "Authorization: Bearer $TOKEN"

# Update an overlay
curl -X PATCH "https://deliverable-specs-api.xema.dev/deliverable-specs/{specId}/overlay-bindings/{bindingId}" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"content": "Updated overlay content..."}'

# Delete an overlay binding
curl -X DELETE "https://deliverable-specs-api.xema.dev/deliverable-specs/{specId}/overlay-bindings/{bindingId}" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Example: Complete Overlay Architecture

```
requirements-standard@1.0.0 (base)
├── stack:nestjs-prisma overlay     → appends NestJS/DB requirements
├── stack:nextjs-vercel overlay     → appends Next.js/Vercel requirements
├── concern:security overlay        → appends threat model section
├── concern:performance overlay     → appends performance budgets
└── concern:accessibility overlay   → appends WCAG checklist
```

**When a NestJS project with security requirements runs:**

```
requirements-standard@1.0.0
  + stack:nestjs-prisma overlay
  + concern:security overlay
  ═══════════════════════════
  = Full requirements doc with NestJS and security sections
```

**When a Next.js frontend runs:**

```
requirements-standard@1.0.0
  + stack:nextjs-vercel overlay
  + concern:accessibility overlay
  ═══════════════════════════════
  = Full requirements doc with Next.js and accessibility sections
```

---

**Previous**: [Schema Validation](./02-schema-validation.md)  
**Next**: [API Reference](./04-api-reference.md)
