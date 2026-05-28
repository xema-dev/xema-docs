# Objects

Every addressable thing in Xema — an agent, a workflow, an artifact, a connector binding, a skill, an execution environment, even a capability grant — is a typed **`XemaObject`**. Objects are the universal noun of Xema OS: the Shell lists them, the Capability Gateway authorizes against them, and biomes compose by emitting and consuming them without needing to know about each other.

---

## XemaObject — the typed envelope

Every object carries the same shape:

```ts
interface XemaObject<TKind extends XemaObjectKind, TPayload> {
  readonly ref: XemaObjectRef;
  readonly kind: TKind;
  readonly scope: ScopeRef;            // 5-tier: system / plugin / org / project / user
  readonly owner: SubjectRef;
  readonly version: SemverVersion;
  readonly lifecycle: ObjectLifecycle; // draft | published | archived
  readonly payload: TPayload;
}
```

The contract lives in the kernel package `@xemahq/xema-object-contracts` (Phase 1A) — biome authors and platform services consume the same types.

### Refs — the universal address

A `XemaObjectRef` is a typed URL into the Object Model:

```
xema://<scope-path>/<kind>/<slug>[@<version>]

Examples:
  xema://org/acme/project/main/agent/code-reviewer@3.0.0
  xema://system/capability/kb.page.read@1
  xema://store/biome/document-buddy@1.4.2
  xema://org/acme/project/main/workflow/escalation
  xema://org/acme/project/main/artifact/spec-2026-05-001
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

`ScopeRef` mirrors the 5-tier scope used by `SkillScope` and `CompositionScope`:

```
User > Project > Org > Plugin > System
```

Precedence is "most specific wins". A user-authored agent shadows a project-authored agent of the same slug; a project-authored agent shadows the org's; the org's shadows a biome-shipped one; biome-shipped shadows kernel-shipped.

### Lifecycle — readiness

`ObjectLifecycle` is closed: `draft | published | archived`. Resolution refuses to serve a non-`published` version — fail-fast. `archived` objects are kept for lineage but never resolved.

### Version — immutable identity

Every object carries a semver `version`. Published versions are immutable; draft revisions live alongside the latest published version. Run-, session-, and app-level lockfiles pin exact versions so re-runs are reproducible — see the Versioning page (lands in Phase 8).

---

## XVFS — the virtual filesystem

Xema OS projects the Object Model into a path-addressable namespace called **XVFS** (Xema Virtual Filesystem). Nothing lives on disk — paths resolve to `XemaObjectRef`.

```
/system/capabilities/<ref>
/system/zones/<environment>
/orgs/<org>/projects/<project>/agents/<slug>
/orgs/<org>/projects/<project>/workflows/<slug>
/orgs/<org>/projects/<project>/biomes/<biomeId>
/orgs/<org>/projects/<project>/artifacts/<artifactRef>
/orgs/<org>/projects/<project>/sessions/<sessionId>
/store/biomes/<biomeId>/versions/<v>
```

"Everything is a file" is a discovery metaphor, not a literal claim. The Shell, the Object Browser, and agents use XVFS paths to navigate; underneath, every path resolves to a typed `XemaObject`.

---

## Phase rollout

Phase 1A ships **only the contracts** — `@xemahq/xema-object-contracts` with `XemaObjectRef`, `XemaObjectKind`, `XemaObject`, and `ScopeRef`. There is no Object Registry service and no live resolver yet.

The runtime arrives in two later phases:

- **Phase 2** ships `object-registry-api` (the read-mostly union catalog over the existing per-domain registries) and the XVFS read path (`GET /xvfs/resolve?path=...`). The frontend Biome Registry and Skills pages begin to consume the projection.
- **Phase 5** ships the XVFS write path, the Shell command surface, and the verb-noun grammar that maps 1:1 onto capability calls.

Until then, the typed surface is authoritative even though the projection layer is not yet live. Biome authors can already declare `XemaObjectKind` values in their manifests; resolution happens against the existing per-domain registries.

---

**Previous**: [← Overview](./overview.md)
**Next**: [Capabilities →](./capabilities.md)
