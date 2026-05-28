# Spaces

A **Space** is the answer to "where does this *thing* live?" in Xema OS — who owns it, who can reach it, and what data-classification floor applies. Every typed object (a knowledge-base page, an artifact, a session, a biome installation, a stored memory) is anchored to exactly one Space.

Spaces replaced the older "Scope" concept. "Scope" was overloaded with OAuth scopes — **Space** is unambiguous and explicit about hierarchy.

---

## The seven-level hierarchy

`SpaceKind` is a closed enum. Precedence — **most specific wins**:

```
User > Session > Biome > App > Project > Org > System
```

| Kind | Owns | Typical inhabitants |
|---|---|---|
| `System` | The Xema platform itself | Built-in capabilities, kernel objects, system skills |
| `Org` | One organization | Org-installed biomes, org-wide knowledge, org connectors |
| `Project` | One project inside an org | Project artifacts, project repos, project memberships |
| `App` | One published app surface | App configuration, audience policies, branded chrome |
| `Biome` | One biome installation | Biome-private storage, biome-owned schemas |
| `Session` | One active interactive session | In-progress documents, session memory, draft work |
| `User` | One end user | Personal skills, personal memory, user-owned drafts |

The set is closed — third-party biomes cannot introduce new Space kinds. Custom environments live inside an existing Space; they do not create new Space kinds.

---

## The `SpaceRef` URI grammar

A Space is referenced by a structured URI:

```
xema://<kind>/<id>[/<kind>/<id>...]
```

Examples:

```
xema://system
xema://org/acme
xema://org/acme/project/billing
xema://org/acme/project/billing/biome/xema.document-buddy@1.4.2
xema://org/acme/project/billing/session/sess_abc123
xema://user/u_42
```

Hard rules:

- Every segment pair is `<kind>/<id>` where `kind` is a `SpaceKind` value and `id` is the kebab-case stable identifier of that Space.
- Segments are ordered from least-specific to most-specific. Reversing the order is a parse error.
- Walking ancestors is the precedence chain for grant resolution: a grant at `xema://org/acme` applies to every descendant unless overridden.

Parse and traverse via `@xemahq/space-contracts`:

```ts
import { parseSpaceRef, ancestorsOf } from '@xemahq/space-contracts';

const ref = parseSpaceRef('xema://org/acme/project/billing');
// → { kind: 'Project', id: 'billing', parent: { kind: 'Org', id: 'acme' } }

for (const ancestor of ancestorsOf(ref)) {
  // visits Project → Org → System
}
```

---

## Data classification

Every Space carries a `DataClassification` ceiling that bounds what kinds of data may live there. The classification is closed (`DataClassification` enum):

| Classification | Meaning |
|---|---|
| `Public` | World-readable; no confidentiality requirement |
| `Internal` | Org-visible only; non-sensitive |
| `Confidential` | Org-visible only; access logged |
| `Secret` | Strict subject allowlist; access audited |
| `Regulated` | Bound by external regimes (GDPR, HIPAA, PCI); residency-controlled |

A child Space inherits its parent's classification floor and may **raise** it (a `Confidential` project under an `Internal` org is fine; the reverse is not). The classification flows into every [Policy](./policy.md) decision: a capability that would emit `Secret` data into a `Public` Space is denied with a structured reason.

---

## How Spaces show up across Xema

Spaces are first-class in every product surface:

- **Object Registry** — every object is indexed by its `SpaceRef`; the Object Browser groups objects by Space.
- **Memory** — memory chunks are scoped by `SpaceRef`; `xema memory recall` filters to the calling subject's reachable Spaces.
- **Knowledge Base** — pages live in a Space; cross-Space reads are policy-mediated.
- **Artifacts** — every artifact version stamps its emitting Space.
- **Skills** — `SkillSpace` (formerly `SkillScope`) names the owning Space; resolution precedence is most-specific-wins.
- **Compositions** — `CompositionSpace` mirrors the Skill model.
- **Frontend routing** — the product URL grammar is `/spaces/orgs/:org/projects/:project/...`, mirroring the SpaceRef path.

---

## Spaces vs Environments

`Space` and [Execution Environment](./environments.md) are orthogonal:

- A **Space** says *where data lives and who owns it*. It is durable, hierarchical, and named.
- An **Environment** says *what trust profile this call runs under*. It is runtime, profile-based, and bound to each invocation.

The same object in `xema://org/acme/project/billing` may be touched from the `org`, `project`, or `sandbox` environment depending on who is calling. The data does not move; the trust profile that applies to the call does.

---

## Spaces in the shell

| Command | What it shows |
|---|---|
| `xema spaces list` | All Spaces the calling subject can reach |
| `xema explain xema://org/acme/project/billing` | Owner, classification, descendant count, recent activity |
| `xema objects list xema://org/acme/project/billing` | Typed objects anchored to the Space |

---

## Related concepts

- [Environments](./environments.md) — the runtime trust profile, orthogonal to Space.
- [Execution contexts](./execution-contexts.md) — every invocation carries one Space and one Environment.
- [Objects](./objects.md) — each `XemaObject` declares its owning Space.
- [Policy](./policy.md) — Space classification feeds into every decision.
- [Skills](./skills/) — `SkillSpace` precedence drives skill resolution.

---

**Previous**: [← Execution Environments](./environments.md)
**Next**: [Execution Contexts →](./execution-contexts.md)
