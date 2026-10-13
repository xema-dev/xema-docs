#!/usr/bin/env node
// GENERATED from tooling/ci/arm64-supplement-needed.mjs
// source-sha256: 2f950ad23759cda8c1f4ed0c703d14bd84ddeaefa6241ad28ced87416e615911
// Edit the canonical source, never this copy.
// ═══════════════════════════════════════════════════════════════════════════
// DOES THIS COORDINATE STILL NEED AN arm64 SUPPLEMENT?
//
// An arm64 supplement lane that rebuilds and re-merges UNCONDITIONALLY does
// more than waste a run. `imagetools create -t :<contentHash>` republishes the
// canonical coordinate by design, so supplementing an ALREADY-COMPLETE index
// MOVES A TAG somebody may already have sealed.
//
// ── WHY A RE-RUN MOVES THE DIGEST AT ALL ────────────────────────────────────
//
// Two builds of the SAME source do not produce the same arm64 manifest unless
// the build is reproducible. Absent a `SOURCE_DATE_EPOCH`, the image config's
// `created` and `history[].created` are WALL-CLOCK, so a rebuild changes the
// config digest and therefore the manifest digest even when every layer byte is
// identical. The amd64 side does not move only because it is never rebuilt by a
// supplement lane — the merge REFERENCES its existing per-commit tag.
//
// Making the arm64 build reproducible is a separate and much larger decision:
// it would move every coordinate's digest on the next build. This probe instead
// makes the question MOOT for a coordinate that is already final, which is the
// cheap half and the one that stops a sealed tag moving under a release.
//
// ── WHY A PROOF AND NOT A READ ──────────────────────────────────────────────
//
// An index descriptor DECLARES a child's platform. The merge is exactly where a
// mislabelled arm64 child would enter, so trusting the declaration would let one
// bad index become permanent: the supplement lane is the only thing that can
// repair it, and a descriptor-only check would skip the repair forever.
//
// So a skip is EARNED — by resolving the child manifest BY DIGEST and reading
// the architecture out of its image CONFIG. A mislabelled index reads as NOT
// SUPPLEMENTED and is rebuilt.
//
// ── FAIL LOUD, NEVER GUESS ──────────────────────────────────────────────────
//
// Only 200 and 404 are answers. A 401/403 on a private package is
// indistinguishable from an image that was never pushed, so anything else
// throws. That direction is deliberate: a supplement lane is off the deploy
// graph, so a red run there costs nothing, whereas a guessed answer either
// moves a sealed tag or silently leaves a coordinate single-platform.
//
// The same posture governs the ENTRYPOINT GUARD at the foot of this file. It
// resolves both sides with `realpathSync` before comparing, because the
// alternative fails in the dangerous direction: a guard that does not match
// runs no `main()`, writes no `needed=` output, and a workflow gating its merge
// on `needed == 'true'` then SKIPS a supplement that was genuinely owed —
// silently, and with a green tick.
//
// No dependency beyond node builtins: this runs from a bare checkout with no
// install, which is what every consuming lane provides and all it provides.
// ═══════════════════════════════════════════════════════════════════════════

import { appendFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

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

// ── REGISTRY TRANSPORT ──────────────────────────────────────────────────────
//
// Self-contained on purpose (this runs before any install): the same posture as
// `@xemahq/repo-build-tooling`'s `registry-fetch`. Node's fetch rejects with a
// bare `TypeError: fetch failed` and keeps the real reason in `error.cause`;
// one transient network error must neither fail the job nor hide its cause.
// Only a TRANSPORT failure (the fetch promise rejects) is retried; an abort is
// rethrown at once, and every HTTP response, whatever its status, is returned
// as is for the caller's own status handling.

/** Total attempts per request, the first included. */
export const REGISTRY_MAX_ATTEMPTS = 3;
/** Fixed wait in milliseconds after failed attempt n (1-based); no jitter. */
export const REGISTRY_RETRY_BACKOFF_MS = [1000, 3000];
const MAX_CAUSE_LINKS = 10;

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The URL with credentials and every query value removed; query keys remain. */
export function redactUrl(input) {
  let url;
  try {
    url = new URL(String(input));
  } catch {
    return '<unparseable url>';
  }
  url.username = '';
  url.password = '';
  const keys = [...new Set(url.searchParams.keys())];
  url.search = '';
  url.hash = '';
  return keys.length > 0
    ? `${url.href}?${keys.map((key) => `${key}=<redacted>`).join('&')}`
    : url.href;
}

function describeOne(error) {
  if (!(error instanceof Error)) return String(error);
  const details = ['code', 'errno', 'syscall', 'hostname']
    .filter((key) => error[key] !== undefined)
    .map((key) => `${key}=${error[key]}`);
  const head = `${error.name}: ${error.message}`;
  return details.length > 0 ? `${head} (${details.join(', ')})` : head;
}

/** One line per link of the `cause` chain, outermost first; bounded, cycle-safe. */
export function describeErrorChain(error) {
  const lines = [];
  const seen = new Set();
  for (
    let current = error;
    current !== undefined &&
    !seen.has(current) &&
    lines.length < MAX_CAUSE_LINKS;

  ) {
    lines.push(describeOne(current));
    if (!(current instanceof Error)) break;
    seen.add(current);
    current = current.cause;
  }
  return lines;
}

function causeCode(error) {
  for (
    let current = error, depth = 0;
    current instanceof Error && depth < MAX_CAUSE_LINKS;
    current = current.cause, depth += 1
  ) {
    if (current.code !== undefined) return String(current.code);
  }
  return 'unknown';
}

/**
 * Send one registry request through `fetchImpl`, retrying transport failures up
 * to REGISTRY_MAX_ATTEMPTS with REGISTRY_RETRY_BACKOFF_MS between attempts. The
 * final failure names the method, the redacted URL and the attempt count, with
 * the last error as `cause`. Headers are never reported. `sleep` replaces the
 * real wait (for tests).
 */
export async function registryFetch(fetchImpl, url, init, { sleep = realSleep } = {}) {
  const method = init?.method ?? 'GET';
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetchImpl(url, init);
    } catch (error) {
      if (error?.name === 'AbortError' || init?.signal?.aborted === true) {
        throw error;
      }
      if (attempt >= REGISTRY_MAX_ATTEMPTS) {
        throw new Error(
          `${method} ${redactUrl(url)} failed after ${attempt} attempts`,
          { cause: error },
        );
      }
      process.stderr.write(
        `registry request failed (attempt ${attempt} of ${REGISTRY_MAX_ATTEMPTS}): ${method} ${redactUrl(url)} cause=${causeCode(error)}; retrying\n`,
      );
      await sleep(REGISTRY_RETRY_BACKOFF_MS[attempt - 1]);
    }
  }
}

/**
 * Acquire a pull-only GHCR bearer token for one repository.
 *
 * The endpoint is deliberately FIXED to the configured host. Following a
 * challenge-provided realm while carrying the long-lived credential would let a
 * misconfigured or untrusted registry redirect that credential elsewhere.
 * Fixed-host by design; see the note above.
 */
export async function acquireGhcrPullToken({
  registry,
  repository,
  user,
  token,
  fetchImpl = fetch,
  sleep,
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
  const response = await registryFetch(
    fetchImpl,
    url,
    {
      method: 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`${user}:${token}`, 'utf8').toString('base64')}`,
        Accept: 'application/json',
      },
    },
    { sleep },
  );
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

async function getJson({
  registry,
  repository,
  reference,
  bearer,
  fetchImpl,
  sleep,
}) {
  const response = await registryFetch(
    fetchImpl,
    `https://${registry}/v2/${repository}/manifests/${reference}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${bearer}`, Accept: MANIFEST_ACCEPT },
    },
    { sleep },
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
  sleep,
}) {
  const { status, document } = await getJson({
    registry,
    repository,
    reference: digest,
    bearer,
    fetchImpl,
    sleep,
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
  const response = await registryFetch(
    fetchImpl,
    `https://${registry}/v2/${repository}/blobs/${configDigest}`,
    { method: 'GET', headers: { Authorization: `Bearer ${bearer}` } },
    { sleep },
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
  sleep,
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
    sleep,
  });
  const { status, document } = await getJson({
    registry,
    repository,
    reference: contentHash,
    bearer,
    fetchImpl,
    sleep,
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
      await childIsArm64({
        registry,
        repository,
        digest,
        bearer,
        fetchImpl,
        sleep,
      })
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

// `realpathSync` on both sides deliberately: `process.argv[1]` is whatever path
// the caller typed, and a guard comparing them unresolved silently runs NOTHING
// — which here means no `needed=` output and a merge that skips a supplement it
// owed. `pathToFileURL` additionally encodes a path a template literal would
// corrupt.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      `::error title=arm64 supplement probe failed::${error.message}`,
    );
    for (const line of describeErrorChain(error)) console.error(`  ${line}`);
    process.exit(1);
  });
}
