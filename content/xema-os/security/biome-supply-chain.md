# Biome supply-chain security

Biomes are distributed as **signed OCI artifacts** with **SLSA v1.0 provenance attestations**. Verification is enforced at install time by `biome-fetcher-api`. There are no silent fallbacks — a biome that fails any verification step cannot install.

This page is the operator runbook for managing trust in that pipeline.

---

## Trust model in one paragraph

The platform trusts an OCI artifact when **all three** hold:

1. `cosign verify` succeeds against an identity (keyless) or public key (keyed) that appears in `BIOME_TRUSTED_PUBLISHERS`;
2. for keyless verification, the certificate's OIDC issuer claim matches `BIOME_TRUSTED_OIDC_ISSUER`;
3. (if `BIOME_REQUIRE_PROVENANCE=true`, default) `cosign verify-attestation --type https://slsa.dev/provenance/v1` succeeds against the same identity/key.

Any failure produces a typed `BIOME_*` error code and a 403 response — install never proceeds.

---

## Configuration env vars (`biome-fetcher-api`)

| Var | Required | Effect |
|---|---|---|
| `BIOME_TRUSTED_PUBLISHERS` | yes (prod) | Comma-separated allowlist. Each entry is either a cosign certificate-identity URI (keyless) or a `key:<path>` entry pointing at a public-key file (keyed). Empty + no `BIOME_ALLOW_UNSIGNED_INSTALL=1` → every install refused. |
| `BIOME_TRUSTED_OIDC_ISSUER` | yes (keyless) | OIDC issuer URI pinned on the cosign cert SAN. Example: `https://token.actions.githubusercontent.com`. |
| `BIOME_REQUIRE_PROVENANCE` | optional | `"true"` (default) requires a valid SLSA v1.0 attestation. `"false"` skips provenance (signature still required). |
| `BIOME_ALLOW_UNSIGNED_INSTALL` | dev only | Set to `"1"` to disable verification entirely in test/dev environments. `biome-fetcher-api` **refuses to start** with it set when `NODE_ENV=production`. |

All four are configured on the `biome-fetcher-api` deployment — supplied as environment variables and sourced from your secret manager rather than committed to values files.

---

## Which signing mode does what

Verification accepts both modes; publishing does not.

| | Keyed | Keyless (Fulcio/OIDC) |
|---|---|---|
| `xema biome publish` | yes — the only supported mode | no |
| `biome-fetcher-api` verification | yes — a `key:<path>` entry in `BIOME_TRUSTED_PUBLISHERS` | yes — a certificate-identity entry + `BIOME_TRUSTED_OIDC_ISSUER` |

So a keyless entry in the allowlist only ever matches an artifact signed by an external CI pipeline that ran `cosign sign` keylessly itself. Artifacts produced by the Xema CLI are keyed.

---

## Keyless OIDC (external publishers)

Keyless signing uses an ambient OIDC token (e.g. GitHub Actions `id-token: write`) to obtain a short-lived Fulcio certificate. The signature is recorded transparently in Rekor. No long-lived signing keys live anywhere. `xema biome publish` does not do this — it is the shape to allowlist when a third party's own pipeline signs.

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

## Keyed signing (the CLI publisher)

The publisher signs with a private key and the cluster verifies with the matching public key. `COSIGN_KEY` carries the private-key ref; `xema biome publish` refuses to run without it.

```bash
# Publisher
COSIGN_KEY=/secrets/cosign.key xema biome publish ./<biome-dir> \
  --registry registry.xemahq.com/biomes --token-env REGISTRY_TOKEN

# Cluster operator — mount the public key, then add an entry
# `key:/secrets/biome-publishers/<name>.pub` to BIOME_TRUSTED_PUBLISHERS.
```

Keyed mode carries a real cost: a leaked key compromises every artifact ever signed with it, and there is no transparent log of issuance. Rotate on the schedule your key-management policy sets, and keep the key out of the CLI's argv — it is read from the environment only.

See [SDK — Publishing](../sdk/publishing.md#bundle-format--oci-artifacts) for the bundle format and the full publish flag set.

---

## SLSA v1.0 provenance

Provenance answers "what built this artifact, from which source, on which runner, with which parameters?". `xema biome publish` generates a SLSA v1.0 predicate and attaches it to the pushed ref with `cosign attest --type https://slsa.dev/provenance/v1`, as the final step of every publish. It is not optional and there is no flag to skip it: the fetcher requires the attestation by default, so a publish that produced only a signature would produce an uninstallable artifact.

What the cluster checks, via `cosign verify-attestation`:

- the attestation's `predicateType` is `https://slsa.dev/provenance/v1` (anything else does not satisfy the requirement);
- its subject digest matches the artifact's image-manifest digest;
- it was signed by an identity or key from the same `BIOME_TRUSTED_PUBLISHERS` allowlist used for the signature.

A biome whose signature comes from a trusted publisher but whose attestation comes from a different identity is **rejected** (`BIOME_PROVENANCE_INVALID`). An artifact with no attestation at all is rejected with `BIOME_PROVENANCE_MISSING`.

### Local builds

The fetcher does not read the provenance body — it does not inspect `builderId`, and there is no special-cased "local" predicate. Trust is decided entirely by which key or certificate identity signed the attestation. A biome signed with a developer's own key therefore installs only where that key is in `BIOME_TRUSTED_PUBLISHERS`, or where `BIOME_ALLOW_UNSIGNED_INSTALL=1` disables verification outright. Both are dev/test postures; neither belongs in production.

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
