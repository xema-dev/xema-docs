# Publishing to the Xema Store

The **Xema Store** lets your biome reach any Xema organization. This page covers the full publishing flow — from a locally validated biome to a store-approved listing.

---

## The five Store capabilities

| Capability | Who uses it | What it does |
|---|---|---|
| `store:biome.list@1` | Anyone | Browse published listings |
| `store:biome.install@1` | Org admin | Install a store-approved biome |
| `store:biome.submit@1` | Biome author | Submit a biome for review |
| `store:biome.approve@1` | Xema store reviewer | Approve a submitted biome |
| `store:biome.archive@1` | Author or reviewer | Archive a published listing |

You need `store:biome.submit@1` to publish. This capability is available to any authenticated Xema user.

---

## The publishing flow

```
local draft
    ↓  xema biome submit
store-submitted   (Xema runs automated tests; SBOM generated; manifest inspected)
    ↓  reviewer approves via store:biome.approve@1
store-approved    (visible to all orgs)
```

### 1. Bundle and sign

```bash
xema biome bundle ./acme-code-review --output ./dist/acme-code-review-1.2.0.tar.gz
```

This produces an OCI-compatible archive. Xema signs the bundle with `cosign` during the automated review stage; the signature is pinned in the Store listing. You do not need to sign the bundle yourself.

The bundle layout matches the OCI artifact spec and includes:
- The biome source folder compressed as a layer.
- A computed SBOM (Software Bill of Materials) listing all npm dependencies.
- A capability manifest derived from `xema-biome.json`.

### 2. Submit

```bash
xema biome submit ./dist/acme-code-review-1.2.0.tar.gz \
  --store-category "developer-tools" \
  --listing-page ./store-listing.md
```

Or through the Biome Studio UI: **Store → Submit Biome → Upload Bundle**.

The submission creates a `store-submitted` entry. Automated checks run immediately:

- Manifest schema validation
- SBOM generation
- Capability risk scoring
- Sandbox execution tests (your biome installs and runs in a `store-review` environment)

### 3. Review

A Xema store reviewer inspects the automated report, checks the sandbox execution results, and reviews the permission digest. Review time depends on capability risk:

| Risk tier | Typical review time |
|---|---|
| `low` (read-only, no connectors) | 1–2 business days |
| `medium` (write capabilities, internal connectors) | 3–5 business days |
| `high` (external connectors, schema migrations) | 7–10 business days |

### 4. Approval

When approved, the biome moves to `store-approved`. The Store listing becomes visible to all orgs. Any org admin can now install it with `store:biome.install@1`.

---

## Versioning

The Store treats `version` in `xema-biome.json` as the canonical version. Semantic versioning is enforced:

- **Patch** (`1.0.0 → 1.0.1`): bug fixes, documentation updates, no manifest changes. Fast-tracked by automated checks.
- **Minor** (`1.0.0 → 1.1.0`): new contributions, new optional capabilities. Full review.
- **Major** (`1.0.0 → 2.0.0`): breaking changes to capability refs, storage schema migrations, removed contributions. Full review + capability diff.

Submit a new version with the same `name` and an incremented `version`. The Store keeps all prior versions available for orgs running pinned installs.

---

## OCI packaging and SLSA

Biome bundles are stored as OCI artifacts in the Xema container registry. Each bundle gets a `cosign`-signed attestation with:

- A SLSA Level 2 provenance statement.
- A `cyclonedx` SBOM.
- The approved capability digest.

Orgs can verify the signature before install:

```bash
xema biome verify acme-code-review --version 1.2.0
```

This checks the `cosign` signature against the Xema public key and prints the full provenance chain.

---

## Updating a published listing

To update metadata (description, listing page, screenshots) without incrementing the version:

```bash
xema store update-listing acme-code-review \
  --listing-page ./store-listing-updated.md
```

Listing metadata updates go through a lightweight review (no sandbox run required). Capability changes always require a version bump and full review.

---

**Previous**: [← Authoring](./02-authoring.md)

**Next**: [Examples →](./examples/)
