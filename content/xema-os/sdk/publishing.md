# SDK — Publishing

Publishing a biome to the [Xema Store](../store.md) is a controlled lifecycle transition, not a `npm publish`. Every transition is a capability call, every submission runs in the `store-review` execution environment before approval, and the published version is immutable.

This page covers the publisher-side flow: from a working biome in the `org-installed` lifecycle to a `store-approved` listing other orgs can install.

---

## The four publishing transitions

| From → To | Capability | Who calls it |
|---|---|---|
| `org-installed → review-required` | `biome:promote@1` | Biome owner (org admin) |
| `review-required → store-submitted` | `biome:submit-to-store@1` (≡ `store:biome.submit@1`) | Biome owner |
| `store-submitted → store-approved` | `biome:approve-in-store@1` (≡ `store:biome.approve@1`) | Store reviewer |
| `store-approved → archived` | `biome:archive@1` (≡ `store:biome.archive@1`) | Biome owner or reviewer |

Every transition is mediated by `xema-capability-router` and stamped to `audit-log-api`. The biome owner cannot self-approve — `biome:approve-in-store@1` requires a reviewer subject distinct from the submitting subject.

---

## Step 1 — promote out of `org-installed`

When you are ready to start the publishing flow, promote the installation to `review-required`:

```bash
xema biome promote <installation-ref> --to review-required
```

The promotion call freezes the current draft into a published version (semver-tagged) and writes the manifest + bundle + permission digest into the review-required state. From this point the biome runs in `sandbox` + `store-review` and is no longer reachable from production org subjects.

---

## Step 2 — submit to the Store

Once the review-required state holds the version you want to publish, submit:

```bash
xema biome submit <installation-ref> --as <listing-id>
```

Submission writes a `StoreListingVersion` row with lifecycle `store-submitted` via `POST /submissions` on `xema-store-api`. The submission carries:

- the immutable manifest;
- the bundle (today: a source tarball; target: an OCI artifact — see below);
- the computed permission digest (capabilities + risk tier + data-access summary + diff against the previously approved version, if any);
- the publisher's signing identity.

From submission onward, the version runs only in `store-review` — no production data, no production credentials, no external network beyond what the environment allows.

---

## Step 3 — review

The Store reviewer interacts with the submission through three endpoints on `xema-store-api`:

| Endpoint | Purpose |
|---|---|
| `POST /submissions/:version/comment` | Structured comment, recorded in the `ReviewLog` |
| `POST /submissions/:version/approve` | Flip to `store-approved`; the version becomes installable by any org |
| `POST /submissions/:version/reject` | Terminal rejection; the publisher must submit a new version |

`GET /submissions/:version/review-log` is the audit trail. Comments are not free-form admin notes — every comment is structurally addressable so the publisher can read and respond.

Approval is the publisher's signal that the version is ready for general install. There is no "soft-launch" or "preview" intermediate state; the version is either `store-submitted`, `store-approved`, archived, or rejected.

---

## Step 4 — install from the Store

Once approved, any org can install the version through `POST /listings/:id/versions/:version/install`. The flow is the standard [biome install flow](../biomes.md#install--stage-1-consent) — Stage-1 permission digest, admin approval, Stage-2 runtime brokering.

The Store records each install as a `StoreInstall` row and emits `xema.store.install.created.v1` on `event-hub-api`. `biome-host-api` subscribes, fetches the bundle, and runs the per-org install. The `BiomeInstallation.storeInstallId` natural-key column ties the two records together.

---

## Bundle format — OCI artifacts

Biomes ship as **OCI artifacts**, not npm packages and not bare `.tgz` files. The same `infra/container-registry/` substrate that holds Docker images stores biome artifacts; the same `cosign` toolchain that signs container images signs biomes.

### Layer layout

A biome OCI artifact is a single image manifest with up to four layers, all under the `application/vnd.xemahq.biome.*` media-type namespace:

| Layer | Media type | Contents |
|---|---|---|
| 0 | `application/vnd.xemahq.biome.manifest+json` | The verbatim `xema-biome.json` bytes |
| 1 | `application/vnd.xemahq.biome.code.tar+gzip` | Compiled code (`dist/`) |
| 2 | `application/vnd.xemahq.biome.contributions.tar+gzip` | Declarative contributions (`skills/`, `agents/`, `workflows/`, `deliverable-specs/`, `document-templates/`, `document-themes/`) |
| 3 | `application/vnd.xemahq.biome.assets.tar+gzip` | Heavy assets (`assets/` — fonts, images, theme binaries) |

Empty optional layers are omitted entirely — a biome with no `assets/` directory ships a three-layer artifact. Heavy assets layer separately so registries can deduplicate them across versions.

### Packaging tool

The repo-local CLI `xema-biome-package` (workspace path `tooling/biome-package/`) does the packaging. From the monorepo root:

```bash
pnpm biome package <biome-dir> --out <oci-layout-dir> --tag registry.xemahq.com/biomes/<id>:<version>
```

This builds the OCI image-layout v1 directory on disk. Add `--push` to push it to the registry via `oras cp`. The CLI emits structured JSON (`biomeId`, `biomeVersion`, `manifestDigest`, layer digests, `provenancePath`, `mode`) to stdout.

### Signing — cosign

Every push signs the artifact with `cosign` in one of two modes:

- **Keyless (recommended for CI).** Set `COSIGN_OIDC_ISSUER`; cosign uses the ambient OIDC token (e.g. GitHub Actions `id-token: write`) to obtain a Fulcio certificate and records the entry in Rekor. No long-lived keys.
- **Keyed.** Set `COSIGN_KEY_PATH` to a private key file. Use only when keyless is impossible (air-gapped CI).

The mode is selected via `--mode keyless|keyed|unsigned` or the env above. The CLI **refuses** to run with no mode selectable — there is no silent default. `--unsigned` is allowed only when `BIOME_ALLOW_UNSIGNED_BUILD=1` is set; the biome-fetcher in production refuses to install unsigned artifacts regardless.

### Provenance — SLSA v1.0

Every push also generates a SLSA v1.0 in-toto attestation describing the build runner, the source repo + commit, the layer digests, and the invocation parameters. The attestation is attached to the OCI artifact via `cosign attest --type=https://slsa.dev/provenance/v1`. Disable with `--no-provenance` (not recommended; the fetcher requires it by default).

### Install-time enforcement

`apps/biome-fetcher-api` verifies signature + provenance **before** any bytes are unpacked. Failure modes:

| Verdict | Error code | HTTP status |
|---|---|---|
| Signature missing | `BIOME_SIGNATURE_MISSING` | 403 |
| Signature invalid | `BIOME_SIGNATURE_INVALID` | 403 |
| Identity not in `BIOME_TRUSTED_PUBLISHERS` | `BIOME_SIGNATURE_IDENTITY_NOT_TRUSTED` | 403 |
| SLSA provenance missing | `BIOME_PROVENANCE_MISSING` | 403 |
| SLSA provenance invalid | `BIOME_PROVENANCE_INVALID` | 403 |
| `cosign` binary absent in container | `BIOME_COSIGN_UNAVAILABLE` | 500 |

See [the biome supply chain page](../security/biome-supply-chain.md) for the trusted-publisher allowlist runbook and the keyless OIDC configuration.

---

## What does *not* change a published version

A published version is immutable. The following actions do **not** edit the version:

- Comment on a submission (writes a `ReviewLog` row, not a manifest change).
- Update the listing's branding metadata (`PATCH /listings/:id` updates listing-level fields, not version-level).
- Archive the listing (hides from new installs but keeps existing installs functional; their lockfile pins the version).

To ship a fix, publish a new version. The user-controlled [versioning](../versioning.md) model is the same one that governs every other Xema object — there is no "edit in place" mode for published biomes.

---

## Lockfile interaction

When a version is approved, `xema-store-api` derives a canonical [lockfile](../versioning.md#lockfile-shape) entry for the bundle. Org-side installs reuse the canonical lockfile fragment in their own composite lockfile, so a biome that is `store-approved` at version `1.4.2` resolves to byte-identical pinned dependencies in every org that installs it.

This is what makes "the same biome in two orgs" mean exactly the same thing — versioning + lockfile + capability digest.

---

## Related pages

- [Store](../store.md) — listing, install, and review endpoints
- [Biomes — lifecycle](../biomes.md#the-biome-lifecycle) — the underlying state machine
- [Versioning](../versioning.md) — draft vs published vs lockfile
- [Manifest reference](./manifest.md) — what the submission carries
- [Testing](./testing.md) — what reviewers run against a submission

---

**Previous**: [← Storage](./storage.md)
**Next**: [UI I contribute →](./ui-i-contribute.md)
