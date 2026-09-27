// Cases for `tooling/release/arm64-supplement-needed.mjs`.
//
// The probe decides whether the arm64 lane REBUILDS and RE-MERGES. A wrong
// answer is expensive in both directions and neither shows up as a failure:
//
//   wrongly `true`  -> the lane republishes `:<contentHash>` under a NEW digest
//                      and MOVES a seal that names it. `seal-image-digests`
//                      then refuses every edition carrying that coordinate —
//                      which is exactly what happened to app-forge-api on
//                      2026-09-21 and blocked five of nine editions.
//   wrongly `false` -> the coordinate stays amd64-only, forever: the amd64
//                      matrix is content-addressed and never re-selects an
//                      existing coordinate, so this lane never re-arms for it.
//
// So both directions are asserted, and the mislabelled-child case is asserted
// SEPARATELY from the absent-child case: it is the only one that fails if the
// config proof is downgraded to reading the index descriptor.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  arm64SupplementNeeded,
  declaredArm64Children,
} from './arm64-supplement-needed.mjs';

const HASH = 'a'.repeat(64);
const ARM_CHILD = `sha256:${'1'.repeat(64)}`;
const AMD_CHILD = `sha256:${'2'.repeat(64)}`;
const ARM_CONFIG = `sha256:${'3'.repeat(64)}`;
const AMD_CONFIG = `sha256:${'4'.repeat(64)}`;

const json = (body, status = 200) => ({
  status,
  json: async () => body,
});

const INDEX_BOTH = {
  mediaType: 'application/vnd.oci.image.index.v1+json',
  manifests: [
    { digest: AMD_CHILD, platform: { os: 'linux', architecture: 'amd64' } },
    { digest: ARM_CHILD, platform: { os: 'linux', architecture: 'arm64' } },
    {
      digest: `sha256:${'9'.repeat(64)}`,
      platform: { os: 'unknown', architecture: 'unknown' },
      annotations: { 'vnd.docker.reference.type': 'attestation-manifest' },
    },
  ],
};

/**
 * A registry whose arm64 child's CONFIG declares `configArchitecture`.
 * Setting it to `amd64` is the mislabelled index the proof exists to catch.
 */
function registry({
  manifest = INDEX_BOTH,
  manifestStatus = 200,
  configArchitecture = 'arm64',
  childStatus = 200,
  tokenStatus = 200,
} = {}) {
  const seen = [];
  const fetchImpl = async (url, init = {}) => {
    const href = String(url);
    seen.push(href);
    if (href.includes('/token?') || href.includes('/token&') || href.endsWith('/token')) {
      return json({ token: 'bearer-value' }, tokenStatus);
    }
    if (href.endsWith(`/manifests/${HASH}`)) {
      return manifestStatus === 200
        ? json(manifest)
        : { status: manifestStatus, json: async () => ({}) };
    }
    if (href.endsWith(`/manifests/${ARM_CHILD}`)) {
      return childStatus === 200
        ? json({ config: { digest: ARM_CONFIG } })
        : { status: childStatus, json: async () => ({}) };
    }
    if (href.endsWith(`/blobs/${ARM_CONFIG}`)) {
      return json({ os: 'linux', architecture: configArchitecture });
    }
    if (href.endsWith(`/blobs/${AMD_CONFIG}`)) {
      return json({ os: 'linux', architecture: 'amd64' });
    }
    assert.fail(`unexpected request: ${href} ${JSON.stringify(init.method)}`);
  };
  return { fetchImpl, seen };
}

const probe = (options) =>
  arm64SupplementNeeded({
    registry: 'ghcr.io',
    repository: 'xema-dev/app-forge-api',
    contentHash: HASH,
    user: 'x',
    token: 'y',
    fetchImpl: registry(options).fetchImpl,
  });

test('a complete index with a PROVEN arm64 child needs no supplement', async () => {
  const { needed, reason } = await probe();
  assert.equal(needed, false);
  assert.match(reason, /already carries a proven linux\/arm64 child/u);
});

test('an index whose arm64 child is MISLABELLED still needs a supplement', async () => {
  // The descriptor says linux/arm64; the image config says amd64. Reading the
  // descriptor alone would skip the rebuild and make a broken index permanent,
  // because this lane is the only thing that can repair one.
  const { needed, reason } = await probe({ configArchitecture: 'amd64' });
  assert.equal(needed, true);
  assert.match(reason, /none proved out against its own config/u);
});

test('an index with amd64 only needs a supplement', async () => {
  const { needed, reason } = await probe({
    manifest: {
      mediaType: 'application/vnd.oci.image.index.v1+json',
      manifests: [
        { digest: AMD_CHILD, platform: { os: 'linux', architecture: 'amd64' } },
      ],
    },
  });
  assert.equal(needed, true);
  assert.match(reason, /declares no linux\/arm64 child/u);
});

test('an index carrying ONLY attestations needs a supplement', async () => {
  const { needed } = await probe({
    manifest: {
      mediaType: 'application/vnd.oci.image.index.v1+json',
      manifests: [
        {
          digest: `sha256:${'9'.repeat(64)}`,
          platform: { os: 'unknown', architecture: 'unknown' },
          annotations: { 'vnd.docker.reference.type': 'attestation-manifest' },
        },
      ],
    },
  });
  assert.equal(needed, true);
});

test('a single-platform manifest needs a supplement', async () => {
  const { needed, reason } = await probe({
    manifest: {
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: { digest: AMD_CONFIG },
    },
  });
  assert.equal(needed, true);
  assert.match(reason, /single manifest/u);
});

test('an ABSENT coordinate needs a supplement', async () => {
  const { needed, reason } = await probe({ manifestStatus: 404 });
  assert.equal(needed, true);
  assert.match(reason, /does not exist/u);
});

test('a 403 THROWS rather than answering', async () => {
  // A 403 on a private package is indistinguishable from an image that was
  // never pushed. Answering either way is a guess; one moves a sealed tag and
  // the other strands a coordinate amd64-only.
  await assert.rejects(probe({ manifestStatus: 403 }), /returned HTTP 403/u);
});

test('a 500 THROWS rather than answering', async () => {
  await assert.rejects(probe({ manifestStatus: 500 }), /returned HTTP 500/u);
});

test('an index referencing an UNRESOLVABLE child THROWS', async () => {
  await assert.rejects(
    probe({ childStatus: 404 }),
    /does not serve/u,
  );
});

test('a non-sha256 content hash THROWS before any request', async () => {
  await assert.rejects(
    arm64SupplementNeeded({
      registry: 'ghcr.io',
      repository: 'xema-dev/app-forge-api',
      contentHash: 'not-a-hash',
      user: 'x',
      token: 'y',
      fetchImpl: async () => assert.fail('no request may be made'),
    }),
    /not a 64-character lowercase content hash/u,
  );
});

test('credentials never leave the configured registry host', async () => {
  await assert.rejects(
    arm64SupplementNeeded({
      registry: 'evil.example.com',
      repository: 'xema-dev/app-forge-api',
      contentHash: HASH,
      user: 'x',
      token: 'y',
      fetchImpl: async () => assert.fail('no request may be made'),
    }),
    /cannot send credentials to registry/u,
  );
});

test('declaredArm64Children selects only linux/arm64 descriptors', () => {
  assert.deepEqual(declaredArm64Children(INDEX_BOTH), [ARM_CHILD]);
  assert.deepEqual(declaredArm64Children({ mediaType: 'x' }), []);
  assert.deepEqual(declaredArm64Children(undefined), []);
  // A descriptor with the right architecture but the wrong OS is not a
  // supplement for this lane.
  assert.deepEqual(
    declaredArm64Children({
      manifests: [
        { digest: ARM_CHILD, platform: { os: 'windows', architecture: 'arm64' } },
      ],
    }),
    [],
  );
});
