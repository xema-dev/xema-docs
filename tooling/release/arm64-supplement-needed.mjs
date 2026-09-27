#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// DOES THIS COORDINATE STILL NEED AN arm64 SUPPLEMENT?
//
// The arm64 lane rebuilt and re-merged UNCONDITIONALLY. `imagetools create -t
// :<contentHash>` republishes the canonical coordinate by design, so a run that
// supplements an ALREADY-COMPLETE index does no useful work and MOVES A TAG
// somebody may already have sealed.
//
// ── THE MEASURED FAILURE ────────────────────────────────────────────────────
//
// Measured in xema-cultivars, on `app-forge-api`. THIS LANE IS NOT A COPY of
// that one — the six arm64 lanes in this fleet differ by hundreds of lines and
// are owned per repository — but it carries the same unconditional
// `imagetools create`, so the same re-run moves the same kind of sealed digest
// here. The port is a port, not a sync.
//
// `ghcr.io/xema-dev/app-forge-api:723843b157…` (source commit bc1a7e2c43):
//
//   2026-09-20 21:24  arm64 run 35538586977 attempt 1 — built arm64
//                     sha256:031eb533…, merged -> index sha256:432daa9a…
//   2026-09-21 10:17  xema-distributions commit 67d5602 SEALED sha256:432daa9a…
//                     into appliance-base, cloud, editorial, oss, xema-internal
//   2026-09-21 14:01  arm64 run 35540929618 ATTEMPT 2 — a re-run of a run that
//                     armed off the SAME build run 35537948806, at the SAME
//                     commit, whose attempt 1 had this one service CANCELLED.
//                     It rebuilt arm64 sha256:3b37a722…, re-merged -> index
//                     sha256:6321fd70…
//   2026-09-21 18:10  `seal-image-digests` begins refusing, correctly:
//                     "already sealed at 432daa9a… but … now resolves to
//                      6321fd70…. The tag MOVED … not drift to reconcile"
//
// Both arm64 builds were of the SAME source. The amd64 child is BYTE-IDENTICAL
// across the two indexes (sha256:c032f154… both times) — because amd64 is never
// rebuilt here, only REFERENCED from `:${COMMIT}`. Only arm64 moved, because
// only arm64 is rebuilt, and no `SOURCE_DATE_EPOCH` is set anywhere in this
// repository: the image config's `created` and `history[].created` are
// wall-clock, so a rebuild changes the config digest and therefore the manifest
// digest even when every layer byte is identical.
//
// Making the arm64 build reproducible is a separate, larger decision — it would
// move every coordinate's digest on the next build, fleet-wide. This script
// makes the question MOOT for a coordinate that is already final, which is the
// cheap half and the one that stops a sealed tag moving under a release.
//
// ── WHY A PROOF AND NOT A READ ──────────────────────────────────────────────
//
// An index descriptor DECLARES a child's platform. `imagetools create` is
// exactly where a mislabelled arm64 would enter, so trusting the declaration
// would let one bad index become permanent: this lane is the only thing that
// can repair it, and a descriptor-only check would skip the repair forever.
//
// So a skip is earned by resolving the child manifest BY DIGEST and reading the
// architecture out of its image CONFIG — the same "prove, do not read" posture
// `verify-image-platforms.mjs` takes at delivery. A mislabelled index reads as
// NOT SUPPLEMENTED and is rebuilt.
//
// ── FAIL LOUD, NEVER GUESS ──────────────────────────────────────────────────
//
// Only 200 and 404 are answers. A 401/403 on a private package is
// indistinguishable from an image that was never pushed, so anything else
// throws. That direction is deliberate: a red arm64 run costs nothing on the
// prod path (this lane is `workflow_run`, off the deploy graph) whereas a
// guessed answer either moves a sealed tag or silently leaves a coordinate
// amd64-only.
//
// THE CREDENTIAL HELPER IS INLINED HERE, and that is a deviation worth stating.
// In the five service repositories this is imported from that repository's own
// `compute-service-build-matrix.mjs`, so the amd64 and arm64 lanes cannot answer
// differently about how a GHCR pull token is obtained. THIS repository has no
// such script — there is no second lane to disagree with — so the helper is
// inlined rather than a sixth copy being vendored from somewhere else. The part
// that carries the security property is kept verbatim: the token endpoint is
// FIXED to the configured host, so a challenge-provided realm can never
// redirect the long-lived credential elsewhere.
//
// No dependency beyond node builtins: this runs from a bare checkout with no
// install.
// ═══════════════════════════════════════════════════════════════════════════

import { appendFileSync } from 'node:fs';

const SHA256_HEX = /^[a-f0-9]{64}$/u;
const DIGEST = /^sha256:[a-f0-9]{64}$/u;

const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

/** The platform a supplement exists to add. */
export const SUPPLEMENT_OS = 'linux';
export const SUPPLEMENT_ARCHITECTURE = 'arm64';

function assertNonEmpty(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is missing or empty`);
  }
  return value;
}

/**
 * Acquire a pull-only GHCR bearer token for one repository.
 *
 * The endpoint is deliberately FIXED to the configured host. Following a
 * challenge-provided realm while carrying the long-lived credential would let a
 * misconfigured or untrusted registry redirect that credential elsewhere.
 * Value-identical in behaviour to the service repositories' shared helper.
 */
export async function acquireGhcrPullToken({
  registry,
  repository,
  user,
  token,
  fetchImpl = fetch,
}) {
  if (registry !== 'ghcr.io') {
    throw new Error(
      `GHCR probe cannot send credentials to registry '${registry}'`,
    );
  }
  assertNonEmpty(user, 'REGISTRY_USER');
  assertNonEmpty(token, 'REGISTRY_TOKEN');
  const url = new URL(`https://${registry}/token`);
  url.searchParams.set('service', registry);
  url.searchParams.set('scope', `repository:${repository}:pull`);
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${token}`, 'utf8').toString('base64')}`,
      Accept: 'application/json',
    },
  });
  if (response.status !== 200) {
    throw new Error(
      `${registry}: pull-token request for ${repository} returned HTTP ${response.status}`,
    );
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(
      `${registry}: pull-token response for ${repository} was not JSON`,
    );
  }
  if (typeof body?.token !== 'string' || body.token.length === 0) {
    throw new Error(
      `${registry}: pull-token response for ${repository} contained no token`,
    );
  }
  return body.token;
}

async function getJson({ registry, repository, reference, bearer, fetchImpl }) {
  const response = await fetchImpl(
    `https://${registry}/v2/${repository}/manifests/${reference}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${bearer}`, Accept: MANIFEST_ACCEPT },
    },
  );
  if (response.status === 404) return { status: 404, document: undefined };
  if (response.status !== 200) {
    throw new Error(
      `${registry}: manifest lookup for ${repository}:${reference} returned HTTP ${response.status}`,
    );
  }
  let document;
  try {
    document = await response.json();
  } catch {
    throw new Error(
      `${registry}: manifest ${repository}:${reference} was not JSON`,
    );
  }
  return { status: 200, document };
}

/**
 * Children whose DESCRIPTOR claims the supplemented platform.
 *
 * BuildKit attestation manifests declare `unknown/unknown` and are excluded by
 * the same predicate that selects the runnable child — deliberately, rather
 * than by naming them, so an unrecognised child is never silently treated as a
 * platform it did not claim.
 *
 * @param {unknown} document a manifest or an index
 * @returns {string[]} candidate child digests
 */
export function declaredArm64Children(document) {
  const manifests = document?.manifests;
  if (!Array.isArray(manifests)) return [];
  return manifests
    .filter(
      (child) =>
        child?.platform?.os === SUPPLEMENT_OS &&
        child?.platform?.architecture === SUPPLEMENT_ARCHITECTURE,
    )
    .map((child) => child?.digest)
    .filter((digest) => typeof digest === 'string' && DIGEST.test(digest));
}

/**
 * Prove one child really is a linux/arm64 image by reading its CONFIG.
 *
 * @returns {Promise<boolean>}
 */
async function childIsArm64({
  registry,
  repository,
  digest,
  bearer,
  fetchImpl,
}) {
  const { status, document } = await getJson({
    registry,
    repository,
    reference: digest,
    bearer,
    fetchImpl,
  });
  // A child an index REFERENCES must resolve. A 404 here is a broken index,
  // not an absent supplement — say which, rather than quietly rebuilding.
  if (status === 404) {
    throw new Error(
      `${registry}: ${repository} index references child ${digest}, which the registry does not serve`,
    );
  }
  const configDigest = document?.config?.digest;
  if (typeof configDigest !== 'string' || !DIGEST.test(configDigest)) {
    throw new Error(
      `${registry}: ${repository}@${digest} declares no usable config digest`,
    );
  }
  const response = await fetchImpl(
    `https://${registry}/v2/${repository}/blobs/${configDigest}`,
    { method: 'GET', headers: { Authorization: `Bearer ${bearer}` } },
  );
  if (response.status !== 200) {
    throw new Error(
      `${registry}: config blob ${repository}@${configDigest} returned HTTP ${response.status}`,
    );
  }
  let config;
  try {
    config = await response.json();
  } catch {
    throw new Error(
      `${registry}: config blob ${repository}@${configDigest} was not JSON`,
    );
  }
  return (
    config?.os === SUPPLEMENT_OS &&
    config?.architecture === SUPPLEMENT_ARCHITECTURE
  );
}

/**
 * Is an arm64 supplement still owed at `registry/repository:contentHash`?
 *
 * `needed: false` ONLY when the canonical coordinate already serves an index
 * whose linux/arm64 child is proven by its own config. Every other resolvable
 * state — absent, single-platform, index without arm64, index whose arm64 child
 * does not prove out — is `needed: true`.
 *
 * @returns {Promise<{ needed: boolean, reason: string }>}
 */
export async function arm64SupplementNeeded({
  registry,
  repository,
  contentHash,
  user,
  token,
  fetchImpl = fetch,
}) {
  if (!SHA256_HEX.test(contentHash ?? '')) {
    throw new Error(
      `'${contentHash}' is not a 64-character lowercase content hash`,
    );
  }
  const bearer = await acquireGhcrPullToken({
    registry,
    repository,
    user,
    token,
    fetchImpl,
  });
  const { status, document } = await getJson({
    registry,
    repository,
    reference: contentHash,
    bearer,
    fetchImpl,
  });
  if (status === 404) {
    return { needed: true, reason: 'the canonical coordinate does not exist' };
  }
  if (!Array.isArray(document?.manifests)) {
    return {
      needed: true,
      reason: `the canonical coordinate is a single manifest (${document?.mediaType ?? 'unknown media type'}), not an index`,
    };
  }
  const candidates = declaredArm64Children(document);
  if (candidates.length === 0) {
    return {
      needed: true,
      reason: `the index declares no ${SUPPLEMENT_OS}/${SUPPLEMENT_ARCHITECTURE} child`,
    };
  }
  for (const digest of candidates) {
    if (
      await childIsArm64({ registry, repository, digest, bearer, fetchImpl })
    ) {
      return {
        needed: false,
        reason: `the index already carries a proven ${SUPPLEMENT_OS}/${SUPPLEMENT_ARCHITECTURE} child (${digest})`,
      };
    }
  }
  return {
    needed: true,
    reason: `the index declares ${candidates.length} ${SUPPLEMENT_OS}/${SUPPLEMENT_ARCHITECTURE} child(ren) but none proved out against its own config`,
  };
}

async function main() {
  const registry = process.env.REGISTRY;
  const image = process.env.IMAGE;
  const contentHash = process.env.CONTENT_TAG;
  if (!registry) throw new Error('REGISTRY is required.');
  if (!image) throw new Error('IMAGE is required.');
  const prefix = `${registry}/`;
  if (!image.startsWith(prefix)) {
    throw new Error(`IMAGE '${image}' is not hosted on '${registry}'`);
  }
  const repository = image.slice(prefix.length);

  const { needed, reason } = await arm64SupplementNeeded({
    registry,
    repository,
    contentHash,
    user: process.env.REGISTRY_USER,
    token: process.env.REGISTRY_TOKEN,
  });

  // THE CORPUS LINE. A skipped supplement and a supplement that silently did
  // nothing exit the same way and print the same tick; the coordinate it
  // graded and the reason are the only things that tell them apart.
  console.log(
    `arm64 supplement ${needed ? 'NEEDED' : 'ALREADY PUBLISHED'} for ` +
      `${image}:${contentHash} — ${reason}`,
  );
  if (!needed) {
    console.log(
      '::notice::Skipping the arm64 build and the index merge. Re-merging an ' +
        'already-complete coordinate would republish the tag under a new digest ' +
        'and move any seal that names it.',
    );
  }

  const out = process.env.GITHUB_OUTPUT;
  if (out) appendFileSync(out, `needed=${needed ? 'true' : 'false'}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(
      `::error title=arm64 supplement probe failed::${error.message}`,
    );
    process.exit(1);
  });
}
