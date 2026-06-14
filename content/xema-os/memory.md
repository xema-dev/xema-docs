# Memory

> API Docs: https://memory-api.xema.dev/api/docs

**Memory** is the structured, scoped, recall-able knowledge plane of Xema OS. It is how agents accumulate durable context across sessions and workflows without having to re-upload that context on every prompt. Memory is owned by `memory-api`; every memory document is typed, anchored to a [Space](./spaces.md), and carries provenance.

Memory is not free-form notes. Each memory is a structured Markdown ledger with a closed `MemoryKind`, a scope, a slug, and a content digest. Agents read and write memory through capabilities (`memory:recall@1`, `memory:write@1`) — never through raw blob reads.

---

## Why digest-gating matters

Memory v2 is **digest-gated** end to end. Every memory document stores a `contentDigest` (SHA-256 of the body); every token-spending pass that touches that document — re-summarization, embedding refresh, the nightly maintenance workflow — first checks whether the digest still matches what it last saw. If it does, the pass skips the document entirely.

This is a hard invariant: **a maintenance pass on an unchanged memory consumes zero tokens.** Without it, nightly maintenance would silently burn the user's LLM budget regenerating identical summaries.

The same digest is used for the cheap re-summarize gate during writes: when `summarySourceDigest === contentDigest`, the summary is up-to-date and no LLM call is issued.

---

## The scope hierarchy

`MemoryScope` is a closed enum. A memory is anchored to exactly one scope; the request context binds the matching tenant IDs (no agent ever supplies them directly).

| Scope | Owner | Typical use |
|---|---|---|
| `ORG` | One organization | Org-wide doctrine, naming conventions, shared lessons |
| `PROJECT` | One project inside an org | Project-specific patterns, recurring corrections, in-flight decisions |
| `USER` | One end user | Personal preferences, drafts, individual lessons |

Precedence on recall is most-specific-wins, mirroring the [Space hierarchy](./spaces.md). A user-scoped memory shadows a project-scoped memory of the same kind and slug; a project-scoped memory shadows an org-scoped one.

---

## The kind taxonomy

`MemoryKind` is a closed enum. The kind determines how the document is structured and how agents are expected to use it.

| Kind | Purpose |
|---|---|
| `LESSON` | Something the agent learned the hard way — a mistake to avoid, a pattern that worked |
| `PATTERN` | A repeating shape — how a class of problems is solved in this org/project/user context |
| `CORRECTION` | A specific user-issued correction — "always do X this way", "never use Y here" |
| `PREFERENCE` | A user or org preference — stylistic choices, defaults, tool selections |

The set is closed — third-party biomes cannot introduce new memory kinds. Domain-specific knowledge belongs in [skill bundles](./skills/) and [artifacts](./objects.md), not in a custom memory kind.

---

## Document shape

Each memory is a single Markdown file with frontmatter (tags) and a ledger of entries. Entries are headed by an ISO-8601 timestamp and appended in newest-first order. Every entry carries an inline HTML comment recording which agent wrote it and from which surface (`agent-session` or `workflow`).

The path is computed and stored as a denormalized cache:

```
/memories/{scopeSegment}/{kindSegment}/{slug}.md
```

Identity is `(organizationId, projectId, userId, scope, kind, slug)` canonicalised by the server. Slugs are lowercase kebab-case, max 64 characters.

---

## Relations

Memories form a graph through `MemoryRelation`. Each relation links a `fromMemory` to a `toMemory` with a free-form `relationKind` (e.g. `supersedes`, `clarifies`, `relates-to`). Relations are scoped to the org and survive renames via the soft-redirect alias table (`MemoryAlias`).

Relations are read-only to agents on the recall side — they surface as cross-links in the resolved memory bundle so an agent following one lesson can see the patterns and corrections that depend on it.

---

## The maintenance workflow

Every write to a memory bumps a per-org write counter (`MaintenanceTrigger.writesSinceRun`). When the counter crosses the configurable threshold, an out-of-band maintenance workflow runs four passes — summary refresh, prune, slug review, and duplicate scan. Each pass writes its observed `contentDigest` into the per-document `maintenanceState` JSON ledger; the next run skips any document whose digest has not changed since the pass last touched it.

This is the digest-gating invariant made operational: maintenance is allowed to run as often as you like, because it is provably idempotent on unchanged content.

---

## Embeddings

Embeddings live out of band in per-dimension shard tables (`memory_embeddings_d{1024,1536,3072,…}`), created by migration. The dimension is per-org, driven by `OrgEmbeddingCommitment`, not platform-wide — pgvector's HNSW index caps dimensions, so a fixed-dim column on `Memory` would lock multi-tenancy.

Reads and writes route to the correct shard via `CommitmentCacheService`, mirroring the pattern in `search-api`. Embedding refresh is itself digest-gated.

---

## Related concepts

- [Spaces](./spaces.md) — the broader hierarchy memory scopes mirror.
- [Skills](./skills/) — durable how-to knowledge owned by `skill-registry-api`, complementary to memory.
- [Capabilities](./capabilities.md) — `memory:recall@1` and `memory:write@1` are the only documented entry points.
- [Policy](./policy.md) — every recall and write is policy-decided like any other capability call.

---

**Previous**: [← Service Registry](./service-registry.md)
**Next**: [MCP and Capabilities →](./mcp-and-capabilities.md)
