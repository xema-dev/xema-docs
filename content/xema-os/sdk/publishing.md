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

Submission writes a `StoreListingVersion` row with lifecycle `store-submitted` via `POST /listings/:id/versions` on `xema-store-api` — a version is always addressed under its listing, never through a separate top-level submission route. The submission carries:

- the immutable manifest;
- the bundle, as a signed OCI artifact (see [Bundle format](#bundle-format--oci-artifacts) below);
- the computed permission digest (capabilities + risk tier + data-access summary + diff against the previously approved version, if any);
- the publisher's signing identity.

From submission onward, the version runs only in `store-review` — no production data, no production credentials, no external network beyond what the environment allows.

---

## Step 3 — review

The Store reviewer interacts with the submission through three endpoints on `xema-store-api`:

| Endpoint | Purpose |
|---|---|
| `POST /listings/:id/versions/:version/comment` | Structured comment, recorded in the `ReviewLog` |
| `POST /listings/:id/versions/:version/approve` | Flip to `store-approved`; the version becomes installable by any org |
| `POST /listings/:id/versions/:version/reject` | Terminal rejection; the publisher must submit a new version |

`GET /listings/:id/versions/:version/review-log` is the audit trail. Comments are not free-form admin notes — every comment is structurally addressable so the publisher can read and respond.

Approval is the publisher's signal that the version is ready for general install. There is no "soft-launch" or "preview" intermediate state; the version is either `store-submitted`, `store-approved`, archived, or rejected.

---

## Step 4 — install from the Store

Once approved, any org can install the version through `POST /listings/:id/versions/:version/install`. The flow is the standard [biome install flow](../biomes.md#install--stage-1-consent) — Stage-1 permission digest, admin approval, Stage-2 runtime brokering.

The Store records each install as a `StoreInstall` row and emits `xema.store.install.created.v1` on `event-hub-api`. `biome-host-api` subscribes, fetches the bundle, and runs the per-org install. The `BiomeInstallation.storeInstallId` natural-key column ties the two records together.

---

## Bundle format — OCI artifacts

Biomes ship as **OCI artifacts**, not npm packages and not bare `.tgz` files. The same container-registry substrate that holds Docker images stores biome artifacts; the same `cosign` toolchain that signs container images signs biomes.

### Layer layout — one layer per file

A biome bundle is a single OCI artifact whose `artifactType` is:

```
application/vnd.xema.biome.manifest.v1+json
```

Every file in the biome tree is pushed as **its own layer**. Each layer carries an `org.opencontainers.image.title` annotation holding that file's biome-root-relative POSIX path — `xema-biome.json`, `skills/code-review/SKILL.md`, `api/acme-api/dist/main.js`, and so on.

That annotation is load-bearing, not decoration. `biome-fetcher-api` unpacks a bundle by running `oras pull --output <dir> <ref>`, and oras materialises each layer at `<dir>/<org.opencontainers.image.title>` — the annotation is the only thing that reconstructs the directory tree. **A layer without it is silently skipped by oras** (`Skipped pulling layers without file name in "org.opencontainers.image.title"`), so an artifact built from opaque tarball layers pulls successfully, writes nothing, and installs an empty bundle. The fetcher then re-tars the reconstructed tree and requires a top-level `xema-biome.json` in it.

Two annotations are stamped on the artifact itself: `org.opencontainers.image.title` = the biome id, `org.opencontainers.image.version` = the manifest `version`.

### What ships

Everything under the biome root except `node_modules/` and `.git/`. There is no include-list and no per-directory layer split — manifest, source, compiled output, contributions, skills and assets all travel as ordinary files. Layer order is the sorted relative path, so the same tree produces the same layer sequence on every publish.

### Publishing tool

`xema biome publish <path>`, from the `@xemahq/xema` CLI. It resolves the target and the file set, runs `oras push`, then `cosign sign` — every prerequisite is fail-fast, nothing is skipped silently.

```bash
xema biome publish ./ --registry ghcr.io/acme --token-env GHCR_TOKEN
```

| Flag | Effect |
|---|---|
| `--registry <host>` | Target OCI registry host, optionally with a namespace path. Overrides a configured `oci` source. |
| `--source <name>` | Name of a configured `oci` source in `xema.config.yaml` to take the registry + token from. Required to disambiguate when several `oci` sources exist. |
| `--token-env <name>` | Env-var **NAME** holding the registry token (used with `--registry`). |
| `--username <user>` | Registry username paired with the token. Default: `token`. |
| `--tag <tag>` | Tag to publish under. Default: the manifest `version`. |
| `--config <path>` | Explicit `xema.config.yaml` path, instead of the standard search order. |
| `--dry-run` | Print the resolved plan and the exact `oras` / `cosign` commands without touching the registry. |

The published reference is `<registry>/<biome-id>:<tag>`. The registry token is always referenced by env-var **name** — never inlined in config, never placed on the command line. The CLI resolves the name and hands the value to oras over `--password-stdin`. With no `--token-env` and no `authTokenEnv` on the configured `oci` source, oras uses ambient credentials; run `oras login` first.

### Signing — keyed cosign

The publisher signs with a **key**. Keyless (Fulcio/OIDC) signing is not supported by `xema biome publish`.

`COSIGN_KEY` holds the cosign private-key ref — the same env var the distribution tooling uses. It is read from the environment and never passed on argv. If `COSIGN_KEY` is unset, the publish **fails before pushing anything**; there is no unsigned mode and no override flag.

```bash
COSIGN_KEY=cosign.key xema biome publish ./ --registry ghcr.io/acme
```

The command run is `cosign sign --yes --key <ref> <ociRef>` — a registry signature on the pushed ref, which is what the fetcher's `cosign verify` looks for. A detached `cosign sign-blob` signature would not be found.

Verification is the broader of the two: `BIOME_TRUSTED_PUBLISHERS` accepts keyless certificate identities *or* a `key:<path>` public key, so an artifact signed keylessly by an external CI pipeline still installs. Only the CLI publisher is keyed-only.

### Provenance — SLSA v1.0

`biome-fetcher-api` requires a SLSA v1.0 in-toto attestation on the artifact **by default**: `BIOME_REQUIRE_PROVENANCE` defaults to `"true"`. It is verified with `cosign verify-attestation --type https://slsa.dev/provenance/v1` against the same trust anchors as the signature, and an artifact without one is refused with `BIOME_PROVENANCE_MISSING` / 403.

`xema biome publish` attaches it for you, as the third and final step of the publish — there is no separate command and no flag to skip it. It generates the predicate, writes it to a private temp file, and runs:

```bash
cosign attest --yes --key "$COSIGN_KEY" \
  --type https://slsa.dev/provenance/v1 \
  ghcr.io/acme/<biome-id>:<tag> \
  --predicate <temp>/slsa-provenance.json
```

The predicate is SLSA v1.0. `buildDefinition.resolvedDependencies` carries one entry per published file with its sha256 — one per pushed layer, so the attestation covers the complete build input rather than a subset. `runDetails.builder.id` is resolved in this order: `XEMA_BIOME_BUILDER_ID` if set, else the GitHub Actions `GITHUB_WORKFLOW_REF`, else `local-developer://<user>@<host>`. There is no unset case, so provenance is never silently omitted.

A deployment that sets `BIOME_REQUIRE_PROVENANCE=false` accepts a signature-only artifact — the signature is still mandatory.

### Install-time enforcement

`biome-fetcher-api` verifies signature + provenance **before** any bytes are unpacked. Failure modes:

| Verdict | Error code | HTTP status |
|---|---|---|
| Signature missing | `BIOME_SIGNATURE_MISSING` | 403 |
| Signature invalid | `BIOME_SIGNATURE_INVALID` | 403 |
| Identity not in `BIOME_TRUSTED_PUBLISHERS` | `BIOME_SIGNATURE_IDENTITY_NOT_TRUSTED` | 403 |
| SLSA provenance missing | `BIOME_PROVENANCE_MISSING` | 403 |
| SLSA provenance invalid | `BIOME_PROVENANCE_INVALID` | 403 |
| `cosign` binary absent in container | `BIOME_COSIGN_UNAVAILABLE` | 500 |

See [the biome supply chain page](../security/biome-supply-chain.md) for the trusted-publisher allowlist runbook and the fetcher's trust configuration.

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
