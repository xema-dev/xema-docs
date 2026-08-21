# Spaces

A **Space** is the answer to "where does this *thing* live?" in Xema OS — who owns it, who can reach it, and what data-classification floor applies. Every typed object (a knowledge-base page, an artifact, a session, a biome installation, a stored memory) is anchored to exactly one Space. A Space is unambiguous and explicit about hierarchy.

---

## The seven-level hierarchy

`SpaceKind` is a closed enum. Precedence — **most specific wins**:

```
App > User > Session > Project > Org > Biome > System
```

Two of those placements surprise people, so they are worth stating rather than
inferring. **`App` is the most specific tier**, not a mid-level one: an app-owned
row is the narrowest thing the platform addresses. And **`Biome` sits second from
last**, below `Org` — a biome ships a default, and an organisation's own row
shadows it. That is the same direction the object model states: the org's
shadows a biome-shipped one, and biome-shipped shadows kernel-shipped.

This order is **declared**, not derived from the containment tree, and the two are
different facts. The tree answers *what contains what*; it cannot rank `Biome`
against `Org` at all, because `User`, `Session`, `Biome` and `Org` are sibling
roots under `System` and share only that root. The ladder supplies an order the
tree never had. Where the tree does speak, the ladder agrees with it — pinned by
the invariant that for every ref `A` and every proper ancestor `B`,
`rank(A) < rank(B)`.

Registries that own fewer tiers declare an **admissible subset** over this one
enum rather than a private copy — which is why the skill and agent planes
document a five-rung `User > Project > Org > Biome > System` and are consistent
with, not contradicting, the seven above.

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
xema://<plural-kind>/<id>[/<plural-kind>/<id>...]
```

Examples:

```
xema://system
xema://orgs/acme
xema://orgs/acme/projects/billing
xema://biomes/xema.document-buddy
xema://sessions/sess_abc123
xema://users/u_42
```

Hard rules:

- Every segment pair is `<plural-kind>/<id>` — the pluralised `SpaceKind` value (`orgs`, `projects`, `apps`, `sessions`, `biomes`, `users`) plus that Space's stable identifier. `xema://system` is the one rootless, id-less form. This is the SAME scope grammar `XemaObjectRef` and search refs use, so a Space URI is always a prefix of the object URIs it contains.
- Segments are ordered from least-specific to most-specific. Reversing the order is a parse error.
- `users`, `biomes` and `sessions` are ROOT-addressable: a User, Biome or Session Space is identified by its own id alone and parents onto System. Only `orgs → projects → apps` nests.
- Walking ancestors is the precedence chain for grant resolution: a grant at `xema://orgs/acme` applies to every descendant unless overridden.

Parse and traverse via `@xemahq/space-contracts`:

```ts
import { parseSpaceRef, ancestorsOf } from '@xemahq/space-contracts';

const ref = parseSpaceRef('xema://orgs/acme/projects/billing');
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
- **Memory** — memory chunks are scoped by `SpaceRef`; `memory recall` filters to the calling subject's reachable Spaces.
- **Knowledge Base** — pages live in a Space; cross-Space reads are policy-mediated.
- **Artifacts** — every artifact version stamps its emitting Space.
- **Skills** — a skill's owning Space is one of five admissible `SpaceKind` tiers; resolution precedence is most-specific-wins.
- **Compositions** — `CompositionSpace` mirrors the Skill model.
- **Frontend routing** — the product URL grammar is `/spaces/orgs/:org/projects/:project/...`, mirroring the SpaceRef path.

---

## Spaces vs Environments

`Space` and [Execution Environment](./environments.md) are orthogonal:

- A **Space** says *where data lives and who owns it*. It is durable, hierarchical, and named.
- An **Environment** says *what trust profile this call runs under*. It is runtime, profile-based, and bound to each invocation.

The same object in `xema://orgs/acme/projects/billing` may be touched from the `org`, `project`, or `sandbox` environment depending on who is calling. The data does not move; the trust profile that applies to the call does.

---

## Spaces in the shell

| Command | What it shows |
|---|---|
| `ls xema://orgs/<org>` | The Spaces and objects reachable under an org |
| `explain xema://orgs/acme/projects/billing` | Owner, classification, descendant count, recent activity |
| `xema objects list xema://orgs/acme/projects/billing` | Typed objects anchored to the Space |

---

## Related concepts

- [Environments](./environments.md) — the runtime trust profile, orthogonal to Space.
- [Execution contexts](./execution-contexts.md) — every invocation carries one Space and one Environment.
- [Objects](./objects.md) — each `XemaObject` declares its owning Space.
- [Policy](./policy.md) — Space classification feeds into every decision.
- [Skills](./skills/) — Space precedence drives skill resolution.

---

**Previous**: [← Execution Environments](./environments.md)
**Next**: [Execution Contexts →](./execution-contexts.md)
