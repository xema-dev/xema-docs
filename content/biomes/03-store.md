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
COSIGN_KEY=cosign.key xema biome publish ./acme-code-review \
  --registry ghcr.io/acme --token-env GHCR_TOKEN
```

This packages the biome tree as an OCI artifact (`artifactType application/vnd.xema.biome.manifest.v1+json`, one layer per file), pushes it, and signs the pushed ref with `cosign`. Signing is the publisher's job and is mandatory — the publish fails before pushing if `COSIGN_KEY` is unset, and the platform refuses to install an unsigned artifact. The signature is pinned in the Store listing.

Everything under the biome root ships except `node_modules/` and `.git/` — manifest, source, compiled output and contributions alike. See [SDK — Publishing](../xema-os/sdk/publishing.md#bundle-format--oci-artifacts) for the full format and flag reference.

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

Biome bundles are stored as OCI artifacts in a container registry. Each bundle carries a `cosign` signature on the pushed ref, plus a SLSA v1.0 in-toto attestation (`predicateType https://slsa.dev/provenance/v1`) attached with `cosign attest`.

`biome-fetcher-api` verifies both **before** any bytes are unpacked, against the trust anchors in `BIOME_TRUSTED_PUBLISHERS`. A missing signature, an untrusted signer, or a missing/invalid attestation is a typed `BIOME_*` failure and a 403 — the install never proceeds. To check an artifact yourself:

```bash
cosign verify --key cosign.pub ghcr.io/acme/acme-code-review:1.2.0
cosign verify-attestation --key cosign.pub \
  --type https://slsa.dev/provenance/v1 \
  ghcr.io/acme/acme-code-review:1.2.0
```

See [Biome supply-chain security](../xema-os/security/biome-supply-chain.md) for the operator runbook.

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

**Next**: [Manifest Reference →](./04-manifest-reference.md)
