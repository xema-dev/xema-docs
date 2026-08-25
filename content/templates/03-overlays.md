# Spec Overlays

**Overlays** add context-specific acceptance guidance to a base deliverable
spec without copying or replacing the base contract.

## Composition Model

An overlay is selected by explicit binding or by matching project context such
as a stack or concern tag. Selected overlays are composed deterministically
with the base spec before the agent receives its run context.

Typical tags include:

- `stack:spring-jpa` for persistence and migration expectations;
- `stack:nextjs-vercel` for web-runtime expectations;
- `concern:security` for threat-model and authorization review;
- `concern:accessibility` for keyboard, semantic, and assistive-technology
  acceptance criteria.

## What an Overlay May Change

An overlay extends acceptance guidance and reviewer dimensions. It does not
contain Template files, renderer code, visual assets, or a second output-kind
definition. Reusable construction guidance remains in a Template selected by
an owner-qualified binding.

## Resolution Rules

Explicit bindings are audit-visible and deterministic. Tag-driven overlays are
resolved from the run context. Xema records the resolved composition used for
the run so later changes do not alter the meaning of completed work.

Conflicting overlays fail composition. They are never ordered by an incidental
database result or silently dropped. An organization-specific overlay can
replace a shared overlay only through the declared override relationship.

## Example

A `requirements-standard` base spec can require problem, scope, acceptance
criteria, and risks. In a project tagged `stack:spring-jpa` and
`concern:security`, its resolved guidance may additionally require database
migration impact, authorization boundaries, input validation, and a threat
model. The base spec remains one reusable acceptance contract.

---

**Previous**: [← Schema Validation](./02-schema-validation.md)

**Next**: [API Reference →](./04-api-reference.md)
