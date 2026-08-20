# Objects

Every addressable thing in Xema — an agent, a workflow, an artifact, a connector binding, a skill, an execution environment, even a capability grant — is a typed **`XemaObject`**. Objects are the universal noun of Xema OS: the Shell lists them, the Capability Gateway authorizes against them, and biomes compose by emitting and consuming them without needing to know about each other.

---

## XemaObject — the typed envelope

Every object carries the same shape:

```ts
interface XemaObject<TKind extends XemaObjectKind, TPayload> {
  readonly ref: XemaObjectRef;
  readonly kind: TKind;
  readonly scope: ScopeRef;            // 5-tier: system / biome / org / project / user
  readonly owner: SubjectRef;
  readonly version: SemverVersion;
  readonly lifecycle: ObjectLifecycle; // draft | published | archived
  readonly payload: TPayload;
}
```

The contract lives in `@xemahq/kernel-contracts` under the `/object` subpath — biome authors and platform services consume the same types.

### Refs — the universal address

A `XemaObjectRef` is a typed URL into the Object Model:

```
xema://<scope-path>/<kind>/<slug>[@<version>]

Examples:
  xema://orgs/acme/projects/main/agent/code-reviewer@3.0.0
  xema://system/capability/kb.page.read@1
  xema://store/biome/document-buddy@1.4.2
  xema://orgs/acme/projects/main/workflow/escalation
  xema://orgs/acme/projects/main/artifact/spec-2026-05-001
```

Refs are stable, addressable, and unambiguous. They are what the Shell, the Capability Gateway, the Object Browser UI, and agents pass around when they refer to "the thing".

---

## Object kinds

`XemaObjectKind` is a closed enum, extended only by kernel PR. The shipped set at v1 covers every primitive Xema knows about today. Highlights:

- Identity and packaging: `Biome`, `App`, `AppClient`, `AudiencePolicy`, `ExternalSubject`, `DelegatedSession`.
- Agent runtime: `Agent`, `AgentComposition`, `Skill`, `Tool`, `Model`, `ModelResolutionRule`.
- Workflow: `Workflow`, `WorkflowRun`, `GateAction`.
- Connectivity and data: `Connector`, `ConnectorBinding`, `MountSource`, `ArtifactType`, `Artifact`.
- Knowledge and documents: `KnowledgeSpace`, `KnowledgePage`, `DocumentTemplate`, `DocumentTheme`, `ChartRuntime`, `PresentationRuntime`, `WidgetKind`.
- Authorization: `Capability`, `ExecutionEnvironment`, `CapabilityGrant`, `ApprovalRule`.
- Runtime and bookkeeping: `Memory`, `MemoryRelation`, `Session`, `EventStream`, `EventSubscription`, `ContributionEntry`.

Adding a new kind is a deliberate kernel-level decision — the same discipline that keeps the wire-format stable.

---

## The scope / lifecycle / version triad

Three orthogonal axes describe every object.

### Scope — who owns it

`SpaceRef` is the ownership reference shared with `SkillSpace` and `AgentSpace`.
`SpaceKind` has seven members; skill and agent resolution use the five that
carry a precedence ladder:

```
User > Project > Org > Biome > System
```

`App` and `Session` are addressable Space kinds that take no part in that
ladder.

Precedence is "most specific wins". A user-authored agent shadows a project-authored agent of the same slug; a project-authored agent shadows the org's; the org's shadows a biome-shipped one; biome-shipped shadows kernel-shipped.

### Lifecycle — readiness

`ObjectLifecycle` is closed: `draft | published | archived`. Resolution refuses to serve a non-`published` version — fail-fast. `archived` objects are kept for lineage but never resolved.

### Version — immutable identity

Every object carries a semver `version`. Published versions are immutable; draft revisions live alongside the latest published version. Run-, session-, and app-level lockfiles pin exact versions so re-runs are reproducible — see [Lockfiles](./concepts/lockfile.md).

---

## XVFS — the virtual filesystem

Xema OS projects the Object Model into a path-addressable namespace called **XVFS** (Xema Virtual Filesystem). Nothing lives on disk — paths resolve to `XemaObjectRef`.

The path segment after the scope is the **singular, kebab-case
`XemaObjectKind`** — `agent`, `skill`, `workflow`, `concept`,
`execution-environment` — never a plural noun:

```
/system/<kind>/<slug>[@<version>]
/orgs/<org>/<kind>/<slug>[@<version>]
/orgs/<org>/projects/<project>/<kind>/<slug>[@<version>]
/users/<userId>/<kind>/<slug>[@<version>]
/biomes/<biomeId>/<kind>/<slug>[@<version>]
```

`/store/biomes/<biomeId>` is recognised by the parser but not yet routable —
it fails with `XVFS_PATH_NOT_IMPLEMENTED`.

"Everything is a file" is a discovery metaphor, not a literal claim. The Shell, the Object Browser, and agents use XVFS paths to navigate; underneath, every path resolves to a typed `XemaObject`.

---

## How objects reach the registry

Objects are not stored twice. `object-registry-api` is a **read-mostly union
catalog**: the source of truth stays with the owning service, and each owner
projects a complete snapshot of its own slice.

Ownership is single-writer — exactly one service owns each `source` slice, and
a projection **replaces** that slice atomically. Thirteen services publish
today, among them `biome-host-api` (biomes), `skill-registry-api` (skills),
`llm-registry-api` (agents and models), `knowledge-base-api` (spaces and
pages), `artifact-store-api` (artifacts) and `xema-shell-api` (the concept
pages you are reading).

There are two ingestion paths, deliberately both:

- **Push** — the owner emits `xema.object-registry.projection.published.v1`
  when its data changes.
- **Pull** — the registry fans out `GET /describe-objects` to every owner at
  boot and on `POST /sync`. This closes the window a freshly restarted replica
  would otherwise sit blind in, and it is the only path for owners that wire no
  event transport.

A missing owner degrades freshness for its own slice alone; it never gates the
registry's boot.

### Reading

`GET /xema-objects` (filter by `kind`, or by `scope` as an XVFS scope-path
prefix), `GET /xema-objects/by-ref`, and `GET /objects/by-space` (a `SpaceRef`
and every descendant). A tenant-scoped BFF mirror of all three sits under
`/bff`.

In practice you reach them through `xema objects list` and `xema objects get`
in the CLI, `xema ls` / `xema cat` / `xema concepts` in the Shell, the Object
Browser and Concepts pages in the web host, and lockfile resolution — the
registry backs the `agent`, `workflow`, `deliverable-spec` and `skill` lockfile
source kinds.

### Writing

`POST /xvfs/write` upserts through the Shell and is gated on the
`xema:object.write@1` capability; a denial returns `XVFS_WRITE_DENIED` (403).
Write paths must not carry an `@version` suffix — the registry assigns the
version on upsert.

---

**Previous**: [← Overview](./overview.md)
**Next**: [Capabilities →](./capabilities.md)
