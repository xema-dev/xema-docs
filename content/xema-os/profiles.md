# Profiles

> API Docs: https://workflow-engine-api.xema.dev/api/docs

> **Stability**: Experimental — the profile model is shipping incrementally. Field names and the assignment surface may change before GA. Explicit grants and policy obligations remain the supported path for production today.

A **Profile** is a named bundle of grants and configuration that an org admin attaches to a [subject](./policy.md) in one step — a user, a service account, or an agent. Profiles are how Xema OS avoids ad-hoc per-subject grant sprawl: instead of writing twenty individual capability grants per new hire, the admin attaches the `support-engineer` profile once and every subject in that role inherits the same authorization surface.

Profiles are first-class typed [objects](./objects.md) of kind `profile`. They compose with [Spaces](./spaces.md) but are not a Space themselves.

---

## What a profile carries

A profile bundles three things, all closed and typed:

| Field | What it holds |
|---|---|
| `grants[]` | Capability grants the profile-holder receives (typed by capability ref, environment, optional resource glob) |
| `environmentDefaults[]` | The execution environments the holder may invoke under without an extra grant |
| `configuration` | Profile-scoped configuration (rate-limit buckets, default audience memberships, default residency) |

Attaching a profile to a subject is one row in the assignment table: `(subjectRef, profileRef, attachedBy, attachedAt)`. The decision the gateway makes at invocation time reads the assignment, expands the profile into its grant set, and evaluates the call as if the grants had been written individually. The expansion is deterministic and cached.

---

## Profile vs explicit grant

A profile is the right tool when the grant set is **reusable across subjects**. An explicit grant is the right tool when the authorization is **specific to one subject and one resource**.

| Use a profile when | Use an explicit grant when |
|---|---|
| Every support engineer needs the same capabilities | One contractor needs read-only access to one project |
| A new role is added quarterly | A one-off incident-response widening |
| Audit needs "show every subject that can publish docs" by role | Audit needs "who has access to this specific binding" |

The two are not mutually exclusive — a subject may hold multiple profiles AND carry explicit grants. The policy decision is the **union** of every active source, then filtered through obligations.

---

## Profile vs policy obligation

This is the comparison that matters for designers.

A [policy obligation](./policy.md) is something the caller **must do** to make a specific call succeed (`RequireMfa`, `BindRegion`, `RedactInAudit`). It attaches to the decision for one invocation.

A profile is something the caller **has** that contributes grants to many future decisions. It attaches to the subject, not to one call.

The two layer cleanly: a `support-engineer` profile grants `connector:tracker.issue.create@1` in the `project` environment. The policy for that capability still adds `RequireMfa` if the subject has not authenticated recently. Profiles do not bypass obligations and obligations do not erase profiles.

---

## Profile vs audience

An [audience](./capabilities.md) is a typed *group* used for routing and bulk-targeting — "send this notification to every member of `org-admins`". A profile is a typed *role* assigned to one subject at a time — "this subject IS a support engineer".

A subject may be in many audiences AND hold many profiles. The two systems answer different questions:

- "Where does this event fan out to?" → audience.
- "What can this subject do?" → profile + explicit grants.

---

## Lifecycle

`ProfileState` is a closed enum:

| State | Meaning |
|---|---|
| `draft` | Profile is being authored; not attachable to subjects |
| `published` | Profile is the live row; new attachments use this version |
| `deprecated` | Existing attachments remain; new attachments are refused |
| `archived` | Profile and all attachments are removed from active resolution; audit retained |

A profile version is immutable once published. Editing a profile creates a new draft version; promoting it deprecates the previous version. Subjects holding the deprecated version continue to receive its grants until reassigned — there is no silent rewrite.

---

## When NOT to use a profile

- For a one-time access widening. Use an explicit grant with `ExpireAt`.
- To bypass an MFA requirement. Profiles do not erase obligations.
- To grant a capability the org has not approved at install time. Profiles compose with the `BiomeInstallGrant` ceiling; they cannot exceed it.

---

## Related concepts

- [Policy](./policy.md) — the policy decision is the union of profile-derived grants, explicit grants, and obligations.
- [Spaces](./spaces.md) — a profile may scope its grants to a specific Space subtree (e.g. `project` only).
- [Capabilities](./capabilities.md) — every grant inside a profile names a capability ref.
- [Objects](./objects.md) — profiles are typed objects of kind `profile`; assignments are typed objects of kind `profile-assignment`.

---

**Previous**: [← Permissions & Access](./permissions.md)
**Next**: [Runners →](./runners.md)
