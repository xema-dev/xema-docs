import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adoptCommitImageByDigest,
  decideCommitAdoption,
  developRepository,
  developRepositoryPath,
  probeDevelopCoordinate,
  readSubjects,
} from './develop-images.mjs';

const SHA = 'c'.repeat(40);
const OTHER = 'd'.repeat(40);
const HASH = 'a'.repeat(64);
const DIGEST_A = `sha256:${'a'.repeat(64)}`;
const DIGEST_B = `sha256:${'b'.repeat(64)}`;
const DEV = 'ghcr.io/o/dev/svc';
const labelled = (revision) => ({ config: { Labels: { 'org.opencontainers.image.revision': revision } } });

test('the dev repository inserts dev/ after the owner; malformed or dev images are refused', () => {
  assert.equal(developRepository('ghcr.io/xema-dev/docs-api'), 'ghcr.io/xema-dev/dev/docs-api');
  assert.equal(developRepositoryPath('ghcr.io/xema-dev/docs-api'), 'xema-dev/dev/docs-api');
  assert.throws(() => developRepository('ghcr.io/xema-dev'), /not <host>/);
  assert.throws(() => developRepository('ghcr.io/dev/x'), /already a dev/);
});

test('the subjects are the deploy-services manifest services', () => {
  assert.deepEqual(readSubjects().map((s) => s.service), ['docs-api']);
});

test('the probe asks only the dev repository, for the hash and the commit', async () => {
  const asked = [];
  const result = await probeDevelopCoordinate({
    service: 'docs-api',
    manifestImage: 'ghcr.io/xema-dev/docs-api',
    contentHash: HASH,
    sha: SHA,
    registry: 'ghcr.io',
    registryOrg: 'xema-dev',
    exists: async (repository, tag) => {
      asked.push(`${repository}:${tag}`);
      return tag === HASH;
    },
  });
  assert.deepEqual(asked.sort(), [`xema-dev/dev/docs-api:${HASH}`, `xema-dev/dev/docs-api:${SHA}`]);
  assert.equal(result.contentExists, true);
  assert.equal(result.commitExists, false);
});

test('registry uncertainty rejects instead of answering missing', async () => {
  await assert.rejects(
    probeDevelopCoordinate({
      service: 'docs-api', manifestImage: 'ghcr.io/xema-dev/docs-api', contentHash: HASH, sha: SHA,
      registry: 'ghcr.io', registryOrg: 'xema-dev',
      exists: async () => { throw new Error('HTTP 503'); },
    }),
    /503/,
  );
});

test('a commit image whose revision label is the SHA is adopted (single image and every platform)', () => {
  assert.deepEqual(decideCommitAdoption(labelled(SHA), SHA), { adopt: true });
  assert.deepEqual(
    decideCommitAdoption({ 'linux/amd64': labelled(SHA), 'linux/arm64': labelled(SHA) }, SHA),
    { adopt: true },
  );
});

test('a mismatching, absent or partial revision label is refused', () => {
  assert.match(decideCommitAdoption(labelled(OTHER), SHA).reason, /not c{40}/);
  assert.equal(decideCommitAdoption({ config: { Labels: {} } }, SHA).adopt, false);
  assert.equal(
    decideCommitAdoption({ 'linux/amd64': labelled(SHA), 'linux/arm64': labelled(OTHER) }, SHA).adopt,
    false,
  );
});

test('an unreadable inspection or a bad SHA is refused', () => {
  assert.equal(decideCommitAdoption(null, SHA).adopt, false);
  assert.equal(decideCommitAdoption({}, SHA).adopt, false);
  assert.equal(decideCommitAdoption(labelled(SHA), 'abc').adopt, false);
});

function movingRegistry(imagesByDigest) {
  const calls = { resolved: 0, inspected: [], tagged: [] };
  return {
    calls,
    deps: {
      devImage: DEV, sha: SHA, contentTag: HASH,
      // The commit tag points at A the first time it is read and at B ever after.
      resolveTag: async () => (calls.resolved++ === 0 ? DIGEST_A : DIGEST_B),
      inspectImage: async (ref) => {
        calls.inspected.push(ref);
        return ref.includes('@') ? imagesByDigest[ref.split('@')[1]] : labelled(OTHER);
      },
      addTag: async (tag, ref) => calls.tagged.push([tag, ref]),
    },
  };
}

test('adoption resolves the commit tag ONCE and verifies and tags that same digest, even if the tag moves', async () => {
  const { calls, deps } = movingRegistry({ [DIGEST_A]: labelled(SHA), [DIGEST_B]: labelled(OTHER) });
  const result = await adoptCommitImageByDigest(deps);
  assert.equal(result.digest, DIGEST_A);
  assert.equal(calls.resolved, 1);
  assert.deepEqual(calls.inspected, [`${DEV}@${DIGEST_A}`]);
  assert.deepEqual(calls.tagged, [[`${DEV}:${HASH}`, `${DEV}@${DIGEST_A}`]]);
});

test('adoption of a digest whose labels do not match refuses and tags nothing', async () => {
  const { calls, deps } = movingRegistry({ [DIGEST_A]: labelled(OTHER), [DIGEST_B]: labelled(SHA) });
  await assert.rejects(adoptCommitImageByDigest(deps), /refusing to add the contentHash tag/);
  assert.deepEqual(calls.tagged, []);
});

test('adoption refuses an invalid digest before inspecting anything', async () => {
  const { calls, deps } = movingRegistry({});
  await assert.rejects(adoptCommitImageByDigest({ ...deps, resolveTag: async () => 'latest' }), /invalid digest/);
  assert.deepEqual(calls.inspected, []);
});
