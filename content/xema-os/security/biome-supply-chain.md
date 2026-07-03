# Biome supply-chain security

Biomes are distributed as **signed OCI artifacts** with **SLSA v1.0 provenance attestations**. Verification is enforced at install time by `biome-fetcher-api`. There are no silent fallbacks — a biome that fails any verification step cannot install.

This page is the operator runbook for managing trust in that pipeline.

---

## Trust model in one paragraph

The platform trusts an OCI artifact when **all three** hold:

1. `cosign verify` succeeds against an identity (keyless) or public key (keyed) that appears in `BIOME_TRUSTED_PUBLISHERS`;
2. for keyless verification, the certificate's OIDC issuer claim matches `BIOME_TRUSTED_OIDC_ISSUER`;
3. (if `BIOME_REQUIRE_PROVENANCE=true`, default) `cosign verify-attestation --type=https://slsa.dev/provenance/v1` succeeds against the same identity/key.

Any failure produces a typed `BIOME_*` error code and a 403 response — install never proceeds.

---

## Configuration env vars (`biome-fetcher-api`)

| Var | Required | Effect |
|---|---|---|
| `BIOME_TRUSTED_PUBLISHERS` | yes (prod) | Comma-separated allowlist. Each entry is either a cosign certificate-identity URI (keyless) or a `key:<path>` entry pointing at a public-key file (keyed). Empty + no `BIOME_ALLOW_UNSIGNED_INSTALL=1` → every install refused. |
| `BIOME_TRUSTED_OIDC_ISSUER` | yes (keyless) | OIDC issuer URI pinned on the cosign cert SAN. Example: `https://token.actions.githubusercontent.com`. |
| `BIOME_REQUIRE_PROVENANCE` | optional | `"true"` (default) requires a valid SLSA v1.0 attestation. `"false"` skips provenance (signature still required). |
| `BIOME_ALLOW_UNSIGNED_INSTALL` | dev only | Set to `"1"` to disable verification entirely in test/dev environments. **Never set in production.** |

All four are configured on the `biome-fetcher-api` deployment — supplied as environment variables and sourced from your secret manager rather than committed to values files.

---

## Keyless OIDC (recommended)

Keyless signing uses an ambient OIDC token (e.g. GitHub Actions `id-token: write`) to obtain a short-lived Fulcio certificate. The signature is recorded transparently in Rekor. No long-lived signing keys live anywhere.

### CI side

A typical entry in `BIOME_TRUSTED_PUBLISHERS`:

```
https://github.com/xemahq/biomes-acme-tickets/.github/workflows/publish-biome.yml@refs/heads/main
```

The certificate-identity is the **workflow ref** that signed the artifact. The cluster operator can narrow trust further (per-branch, per-repo, or per-tag) by tightening the entries in the allowlist.

### Operator side

To add a new trusted publisher, append its identity to the comma-separated
`BIOME_TRUSTED_PUBLISHERS` value in your secret manager, then restart (roll)
the `biome-fetcher-api` deployment so it re-reads the environment.

Trust changes apply only to subsequent install requests. Already-installed biomes are not re-verified retroactively — the verification gate runs on the install path, not on every runtime call.

---

## Keyed signing (escape hatch)

When keyless is impossible (air-gapped CI), the publisher signs with a private key and the cluster verifies with the matching public key.

```bash
# Publisher
COSIGN_KEY_PATH=/secrets/cosign.key pnpm biome package <biome-dir> \
  --out _tmp/oci --tag registry.xemahq.com/biomes/<id>:<version> --push --mode keyed

# Cluster operator — mount the public key, then add an entry
# `key:/secrets/biome-publishers/<name>.pub` to BIOME_TRUSTED_PUBLISHERS.
```

Keyed mode is supported but **discouraged**: a leaked key compromises every artifact ever signed with it, and there is no transparent log of issuance.

---

## SLSA v1.0 provenance

Provenance answers "what built this artifact, from which source, on which runner, with which parameters?". The packager generates an in-toto statement whose `predicate` is the SLSA v1.0 `provenance` document, then attaches it to the artifact via `cosign attest`.

Required fields the cluster checks:

- `predicateType=https://slsa.dev/provenance/v1`
- subject digest matches the artifact's image-manifest digest
- builder identity (Fulcio cert SAN) matches the same `BIOME_TRUSTED_PUBLISHERS` allowlist used for the signature

A biome whose signature comes from a trusted publisher but whose attestation comes from a different identity is **rejected** (`BIOME_PROVENANCE_INVALID`).

### Local builds

Provenance generated on a developer laptop carries `builderId = local-developer://<user>@<host>`. This is **never** trusted by the production allowlist. The fetcher refuses `local-developer://` provenance unless `BIOME_ALLOW_UNSIGNED_INSTALL=1` is set — i.e. local builds are for local testing only.

---

## Disaster scenarios

### Lost / compromised signing key (keyed mode)

1. Remove the affected `key:<path>` entry from `BIOME_TRUSTED_PUBLISHERS`.
2. Rotate the backing secret.
3. Restart `biome-fetcher-api` deployments.
4. Re-sign and re-push every active biome version with a fresh key, then add the new public key.

Installed-but-not-yet-fetched biomes will fail their next pull. Already-installed biomes keep working — re-verification does not run unless the org reinstalls.

### Compromised OIDC publisher (keyless mode)

1. Tighten or remove the affected identity from `BIOME_TRUSTED_PUBLISHERS`.
2. Roll the deployment.
3. Inspect the Rekor transparency log for unauthorized signatures issued against the compromised identity.

### `cosign` binary missing from the fetcher image

Symptom: `BIOME_COSIGN_UNAVAILABLE` on every OCI install. Fix: the fetcher's container image must include the cosign binary — `COPY` it in (or `apk add cosign`) as part of the `biome-fetcher-api` image build.

---

## Related pages

- [SDK — Publishing](../sdk/publishing.md) — the publisher-side flow
- [Biomes — Lifecycle](../biomes.md) — install / promote / archive transitions
- [Xema Store](../store.md) — review + approval surface
