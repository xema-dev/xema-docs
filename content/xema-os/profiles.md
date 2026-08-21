# Profiles

> **Status: NOT IMPLEMENTED.** There is no profile object kind, no profile
> table, no assignment surface, and no lifecycle enum anywhere in the platform.
> This page records a design direction so it is not reinvented — it does not
> describe something you can use today. The supported path for production is
> explicit [capability grants](./permissions.md), org roles, and team
> membership.

A **Profile** would be a named bundle of grants and configuration that an org
admin attaches to a [subject](./execution-contexts.md) in one step — a user, a
service account, or an agent. The problem it addresses is real: writing twenty
individual capability grants for every new hire does not scale, and the grant
set for "a support engineer" is the same every time.

---

## Why it is worth naming even unbuilt

The comparison below is the part that matters, because it is what keeps three
adjacent concepts from being collapsed into each other. Each answers a
different question, and the platform already ships two of the three.

### Profile vs explicit grant

A profile would be the right tool when the grant set is **reusable across
subjects**. An explicit grant is the right tool when the authorization is
**specific to one subject and one resource**.

| A profile would fit | An explicit grant fits |
|---|---|
| Every support engineer needs the same capabilities | One contractor needs read-only access to one project |
| A new role is added quarterly | A one-off incident-response widening |
| "Show every subject that can publish docs" by role | "Who has access to this specific resource" |

They would not be exclusive: a subject could hold profiles *and* carry explicit
grants, and the decision would be the union.

### Profile vs policy obligation

A [policy obligation](./policy.md) is something the caller **must do** for one
specific call to succeed — `require-human-approval`, `data-residency`,
`redact-secrets`. It attaches to a decision.

A profile is something the caller **has**, contributing grants to many future
decisions. It attaches to the subject.

They would layer, not compete: a profile granting a capability does not erase
the obligation policy attaches when that capability is invoked. This distinction
is live today even without profiles — an explicit grant does not erase an
obligation either.

### Profile vs audience

An [audience](./capabilities.md) is a typed *group* used for routing and bulk
targeting — "send this to every member of `org-admins`". A profile would be a
typed *role* held by one subject — "this subject IS a support engineer".

- "Where does this event fan out to?" → audience.
- "What can this subject do?" → grants and roles today; profiles, if they ship.

---

## What to use instead, today

- **[Capability grants](./permissions.md)** — the shipped mechanism. A grant
  names a subject, a capability, and an [execution environment](./environments.md).
- **Org roles and teams** — the shipped way to give many people the same
  authority at once.
- **Biome install grants** — the ceiling a biome's capabilities may operate
  within, set once at install.

---

## Related concepts

- [Permissions & Access](./permissions.md) — the access model that actually ships.
- [Policy](./policy.md) — obligations attach to a decision, not to a subject.
- [Capabilities](./capabilities.md) — every grant names a capability ref.
- [Spaces](./spaces.md) — where a grant's subject and resource live.

---

**Previous**: [← Permissions & Access](./permissions.md)
**Next**: [Runners →](./runners.md)
