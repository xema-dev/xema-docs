# SDK — Contributions

A **contribution** is anything a biome adds to Xema OS: an agent definition, a workflow, a skill bundle, a mount source, a connector binding, a UI route, a document template. The unified surface for every contribution is the **`contributions/`** directory at the biome root, with one `*.contribution.json` file per contribution.

This page is the authoring guide for those files.

---

## The directory shape

A typical biome's `contributions/` directory looks like:

```
contributions/
├── agent.greeter.contribution.json
├── workflow.escalation.contribution.json
├── skill.documentation.contribution.json
├── connector.github.contribution.json
├── mount-source.cve-feed.contribution.json
└── document-template.invoice.contribution.json
```

One file = one contribution. Filenames are kebab-case; the prefix before the first dot conventionally matches the contribution kind, but that is a convention, not a requirement — the file's `kind` field is authoritative.

Inline contributions are also possible — declare them directly in `xema-biome.json` under `contributions.inline[]`. Use inline only for one-or-two-shot trivia; the directory form scales better, is easier to diff, and matches the format the publish pipeline expects.

---

## The contribution envelope

Every `*.contribution.json` shares the same shape:

```ts
interface Contribution<TKind extends ContributionKind, TManifest> {
  kind:    TKind;             // closed enum value
  slug:    string;            // kebab-case; biome-unique within this kind
  version: string;            // semver; pinned by the lockfile

  // Exactly one of the next two is required:
  directory?: string;         // path to a folder of free-form assets
  inline?:    TManifest;      // the kind-specific manifest, inline

  metadata?: {
    title?:    string;
    summary?:  string;
    tags?:     string[];
  };
}
```

Hard rules:

- `kind` MUST be a value of the closed `ContributionKind` enum. Unknown values fail validation at `xema biome lint` time.
- Exactly one of `directory` or `inline` MUST be present.
- `slug` is unique within `(biome, kind)`. The full registered slug is `<biomeId>.<kind>.<slug>@<version>`.

---

## When to use `directory`

Use `directory` when the contribution is a **folder bundle** — multiple files, a `README.md`, scripts, reference material, or other free-form assets the runtime needs to mount.

The contribution kinds that benefit from a directory:

- **agent-skill** — the canonical example. Skills are folder bundles with `SKILL.md`, `reference/`, `scripts/`, `assets/`, and recursive sub-skills.
- **agent-definition** — when the agent ships templated prompts, intrinsic-tool fixtures, or per-language variants.
- **workflow-definition** — when the workflow ships YAML plus support scripts or test fixtures.
- **mount-source** — when the source ships a runtime module plus declarative config.
- **document-template** — when the template ships theme assets and snippets.

```jsonc
{
  "kind":    "agent-skill",
  "slug":    "documentation",
  "version": "1.0.0",
  "directory": "./skills/documentation",
  "metadata": {
    "title":   "Documentation Skill",
    "summary": "Authors public Xema docs under data/docs/public/.",
    "tags":    ["skill", "docs"]
  }
}
```

The runtime mounts the entire directory contents at the appropriate location — for `agent-skill`, that is the agent runtime's skills location inside the workspace, under a directory named after the contribution's `slug`. The platform reads only the contract files in the bundle (`SKILL.md` for skills); everything else is mounted as-is for the agent to discover.

---

## When to use `inline`

Use `inline` when the contribution is a **typed manifest** — a small JSON object the runtime parses and acts on without needing to mount files.

The kinds that benefit from inline:

- **capability** — a typed capability registration (ref, input/output schemas, side-effect labels).
- **role-capability** — a role → capability mapping.
- **artifact-type** — an artifact-type definition.
- **icon** — a small icon descriptor.
- **connector-adapter** — a connector provider registration.

```jsonc
{
  "kind":    "artifact-type",
  "slug":    "design-review-notes",
  "version": "1.0.0",
  "inline": {
    "displayName": "Design Review Notes",
    "category":    "documentation",
    "validations": [
      { "kind": "min-words", "min": 200 }
    ]
  }
}
```

`inline` is a typed object whose shape is set by the kind's Zod schema (in `@xemahq/<kind>-contracts`). Unknown fields fail validation; required fields are non-negotiable.

---

## The closed `ContributionKind` enum

A short, illustrative slice. The authoritative list is the `ContributionKind` enum in `@xemahq/contribution-contracts`.

| Kind | Body shape | Typical layout |
|---|---|---|
| `agent-definition` | inline or directory | `./agents/<slug>.agent.yaml` |
| `agent-skill` | directory | `./skills/<slug>/SKILL.md` + bundle |
| `workflow-definition` | inline or directory | `./workflows/<slug>.workflow.yaml` |
| `deliverable-spec` | inline | typed manifest |
| `document-template` | directory | template assets |
| `document-theme` | directory | theme assets |
| `mount-source` | directory | module + config |
| `artifact-type` | inline | typed manifest |
| `connector-binding` | inline | provider + auth ref |
| `capability` | inline | ref + schemas |
| `role-capability` | inline | role → capabilities |
| `connector-adapter` | inline | provider registration |
| `project-kit` | directory | scaffold + bootstrap |
| `frontend-route` | directory | route module |
| `host-extension-slot` | inline | slot id + module ref |
| `widget-kind` | inline | widget descriptor |
| `icon` | inline | icon descriptor |

Adding a new kind is a kernel PR — one enum entry plus the Zod schema for its inline shape. No new top-level directory, no new seeder, no scattered registry updates.

---

## Validation, lint, install

Three checks fire on the contributions:

```bash
xema biome lint            # static: schema validation + boundary CI
xema biome install ./       # runtime: register contributions with the local Xema
xema biome publish ./       # push + cosign-sign the OCI artifact
```

Lint failures are typed and structural — the failure message names the file, the field, and the closed-set value that was expected.

---

## Migration from legacy layouts

Older biomes used per-kind top-level directories (`agents/`, `workflows/`, `skills/`, …) and the `xema.content.*` / `xema.modules.*` manifest blocks. Both shapes lift cleanly into `contributions/`:

- Every former `xema.content.agents` entry becomes one `agent-definition` contribution.
- Every former `xema.modules.mount-sources` entry becomes one `mount-source` contribution.
- The top-level directories may stay where they are — the contribution files just point at them via `directory`.

The migration is mechanical and idempotent. The codemod `tooling/codegen/biome-content-to-contributions.mjs` (shipped with the AWP collapse phase) walks every biome and produces the `contributions/` directory in place.

---

## Related concepts

- [Manifest](./manifest.md) — the `contributions` block in `xema-biome.json`.
- [Biomes](../biomes.md) — the bigger picture of what a biome is.
- [Capabilities](../capabilities.md) — `capability` contributions become invocation surfaces.
- [Skills](../skills/) — `agent-skill` contributions are the canonical folder bundles.

---

**Previous**: [← Manifest](./manifest.md)
**Next**: [Lifecycle Hooks →](./lifecycle-hooks.md)
