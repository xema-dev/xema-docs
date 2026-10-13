#!/usr/bin/env node
// The develop image lane's coordinate rules (T62 contract C1).
//
// A green push to `develop` publishes every subject of this repository at
//   <host>/<owner>/dev/<name>:<contentHash>   (the release lane's own key)
//   <host>/<owner>/dev/<name>:<commit>        (the producing develop SHA)
// The `dev/` namespace segment keeps a develop build from ever touching a
// release coordinate (`<host>/<owner>/<name>`).
//
// The subjects are the services of `deploy-services-manifest.json`: the same
// file build-image.yaml asserts its build universe against. The contentHash is
// NOT computed by any rule here: `compute-image-tag.mjs` produces it exactly as
// the release lane does (`--service <s> --path <p> --commit <sha>`).
//
// Subcommands (Node builtins only; this repository has no runtime dependencies):
//   plan    [--commit <sha>]   prints one JSON line per subject
//                              {service, path, imageRepository, devImage, contentHash}
//                              (contentHash computed at --commit, default HEAD).
//   adopt   env: DEV_IMAGE SHA CONTENT_TAG [GITHUB_OUTPUT]
//           The commit tag exists and the contentHash tag does not (a previous run
//           pushed the first and died before the second). Resolves the commit tag
//           to a digest ONCE, verifies that exact digest's revision labels equal
//           SHA, and adds the contentHash tag to that same digest. A mismatch refuses.
//   probe   env: SERVICE MANIFEST_IMAGE CONTENT_TAG SHA REGISTRY REGISTRY_ORG
//                REGISTRY_USER REGISTRY_TOKEN [GITHUB_OUTPUT]
//           emits dev_image, content_exists, commit_exists.
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(HERE, 'deploy-services-manifest.json');
const RELEASE_IMAGE = /^([a-z0-9.-]+)\/([a-z0-9][a-z0-9._-]*)\/([a-z0-9][a-z0-9._-]*)$/;
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const CONTENT_HASH = /^[a-f0-9]{64}$/;
const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

/** `<host>/<owner>/<name>` -> `<host>/<owner>/dev/<name>`. */
export function developRepository(releaseImage) {
  const match = RELEASE_IMAGE.exec(releaseImage);
  if (!match) {
    throw new Error(`release image '${releaseImage}' is not <host>/<owner>/<name>`);
  }
  const [, host, owner, name] = match;
  if (owner === 'dev') {
    throw new Error(`release image '${releaseImage}' is already a dev coordinate`);
  }
  return `${host}/${owner}/dev/${name}`;
}

/** The registry-API repository path (no host): `<owner>/dev/<name>`. */
export function developRepositoryPath(releaseImage) {
  return developRepository(releaseImage).split('/').slice(1).join('/');
}

/** The subjects: every service of the deploy-services manifest. */
export function readSubjects(manifestPath = MANIFEST_PATH) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.services) || manifest.services.length === 0) {
    throw new Error(`${manifestPath} declares no services`);
  }
  return manifest.services.map(({ service, path, imageRepository }) => ({
    service,
    path,
    imageRepository,
  }));
}

/** Returns `true` only for a proven existing manifest and `false` only for 404. */
export async function ghcrManifestExists({
  registry,
  repository,
  tag,
  user,
  token,
  fetchImpl = fetch,
}) {
  if (registry !== 'ghcr.io') {
    throw new Error(`refusing to send credentials to registry '${registry}'`);
  }
  if (!user || !token) throw new Error('REGISTRY_USER and REGISTRY_TOKEN are required');
  const url = new URL(`https://${registry}/token`);
  url.searchParams.set('service', registry);
  url.searchParams.set('scope', `repository:${repository}:pull`);
  const tokenResponse = await fetchImpl(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${token}`, 'utf8').toString('base64')}`,
      Accept: 'application/json',
    },
  });
  if (tokenResponse.status !== 200) {
    throw new Error(`pull-token request for ${repository} returned HTTP ${tokenResponse.status}`);
  }
  const body = await tokenResponse.json();
  if (typeof body?.token !== 'string' || body.token.length === 0) {
    throw new Error(`pull-token response for ${repository} contained no token`);
  }
  const response = await fetchImpl(`https://${registry}/v2/${repository}/manifests/${tag}`, {
    method: 'HEAD',
    headers: { Authorization: `Bearer ${body.token}`, Accept: MANIFEST_ACCEPT },
  });
  if (response.status === 200) return true;
  if (response.status === 404) return false;
  throw new Error(`manifest lookup for ${repository}:${tag} returned HTTP ${response.status}`);
}

/**
 * Ask whether the develop coordinates already exist. `exists(repositoryPath, tag)`
 * is injected; registry uncertainty must throw, never answer false.
 */
export async function probeDevelopCoordinate({
  service,
  manifestImage,
  contentHash,
  sha,
  registry,
  registryOrg,
  exists,
}) {
  if (!COMMIT_SHA.test(sha)) {
    throw new Error(`SHA '${sha}' is not an exact 40-character lowercase commit id`);
  }
  if (!CONTENT_HASH.test(contentHash)) {
    throw new Error(`contentHash '${contentHash}' is not 64 lowercase hex`);
  }
  const expected = `${registry}/${registryOrg}/${service}`;
  if (manifestImage !== expected) {
    throw new Error(`${service}: manifest image '${manifestImage}' differs from '${expected}'`);
  }
  const repositoryPath = developRepositoryPath(manifestImage);
  return {
    devImage: developRepository(manifestImage),
    contentExists: await exists(repositoryPath, contentHash),
    commitExists: await exists(repositoryPath, sha),
  };
}

const REVISION_LABEL = 'org.opencontainers.image.revision';

/**
 * Decide whether an existing `:<sha>` image may have its missing contentHash tag
 * ADDED to its digest. `inspected` is the parsed `.Image` of
 * `docker buildx imagetools inspect`: one image config, or a map of platform ->
 * image config. Adopt only when at least one image config is found and EVERY one
 * carries the revision label equal to `sha`; anything else refuses.
 */
export function decideCommitAdoption(inspected, sha) {
  if (!COMMIT_SHA.test(sha)) {
    return { adopt: false, reason: `SHA '${sha}' is not an exact 40-character lowercase commit id` };
  }
  if (inspected === null || typeof inspected !== 'object') {
    return { adopt: false, reason: 'the image inspection is unreadable' };
  }
  const configs = 'config' in inspected
    ? [inspected]
    : Object.values(inspected).filter((v) => v !== null && typeof v === 'object' && 'config' in v);
  if (configs.length === 0) {
    return { adopt: false, reason: 'the inspection carries no image config to read a revision label from' };
  }
  for (const image of configs) {
    const revision = image.config?.Labels?.[REVISION_LABEL];
    if (revision !== sha) {
      return {
        adopt: false,
        reason: `the existing image's ${REVISION_LABEL} is '${revision ?? 'absent'}', not ${sha}`,
      };
    }
  }
  return { adopt: true };
}

/**
 * Add the contentHash tag to the existing commit image, by DIGEST. The commit
 * tag is resolved exactly once; everything after addresses `<image>@<digest>`.
 * `resolveTag`, `inspectImage` and `addTag` are injected (docker in production).
 */
export async function adoptCommitImageByDigest({ devImage, sha, contentTag, resolveTag, inspectImage, addTag }) {
  const digest = await resolveTag(`${devImage}:${sha}`);
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) {
    throw new Error(`refusing to add the contentHash tag: invalid digest '${digest}'`);
  }
  const pinned = `${devImage}@${digest}`;
  const decision = decideCommitAdoption(await inspectImage(pinned), sha);
  if (!decision.adopt) {
    throw new Error(`refusing to add the contentHash tag to the existing commit image: ${decision.reason}`);
  }
  await addTag(`${devImage}:${contentTag}`, pinned);
  return { digest };
}

const imagetools = (args) => execFileSync('docker', ['buildx', 'imagetools', ...args], { encoding: 'utf8' });

function plan(argv) {
  const at = argv.indexOf('--commit');
  const commit = at >= 0 ? argv[at + 1] : execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!COMMIT_SHA.test(commit ?? '')) throw new Error(`--commit '${commit}' is not a 40-hex commit`);
  for (const subject of readSubjects()) {
    const contentHash = execFileSync(
      'node',
      [join(HERE, 'compute-image-tag.mjs'), '--service', subject.service, '--path', subject.path, '--commit', commit],
      { encoding: 'utf8' },
    ).trim();
    if (!CONTENT_HASH.test(contentHash)) {
      throw new Error(`compute-image-tag.mjs emitted '${contentHash}' for ${subject.service}; expected 64 hex`);
    }
    console.log(JSON.stringify({ ...subject, devImage: developRepository(subject.imageRepository), contentHash }));
  }
}

async function probe() {
  const {
    SERVICE = '', MANIFEST_IMAGE = '', CONTENT_TAG = '', SHA = '',
    REGISTRY = '', REGISTRY_ORG = '', REGISTRY_USER = '', REGISTRY_TOKEN = '',
  } = process.env;
  const result = await probeDevelopCoordinate({
    service: SERVICE,
    manifestImage: MANIFEST_IMAGE,
    contentHash: CONTENT_TAG,
    sha: SHA,
    registry: REGISTRY,
    registryOrg: REGISTRY_ORG,
    exists: (repository, tag) =>
      ghcrManifestExists({ registry: REGISTRY, repository, tag, user: REGISTRY_USER, token: REGISTRY_TOKEN }),
  });
  const lines = [
    `dev_image=${result.devImage}`,
    `content_exists=${result.contentExists}`,
    `commit_exists=${result.commitExists}`,
  ];
  for (const line of lines) console.log(line);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

async function main() {
  const command = process.argv[2];
  if (command === 'plan') return plan(process.argv.slice(3));
  if (command === 'probe') return probe();
  if (command === 'adopt') {
    const { DEV_IMAGE = '', SHA = '', CONTENT_TAG = '' } = process.env;
    const { digest } = await adoptCommitImageByDigest({
      devImage: DEV_IMAGE,
      sha: SHA,
      contentTag: CONTENT_TAG,
      resolveTag: (ref) => JSON.parse(imagetools(['inspect', ref, '--format', '{{json .Manifest}}'])).digest,
      inspectImage: (ref) => JSON.parse(imagetools(['inspect', ref, '--format', '{{json .Image}}'])),
      addTag: (tagRef, digestRef) => {
        imagetools(['create', '-t', tagRef, digestRef]);
      },
    });
    console.log(`added ${DEV_IMAGE}:${CONTENT_TAG} to ${digest}, the verified build of ${SHA}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `digest=${digest}\n`);
    return;
  }
  throw new Error(`unknown command '${command}'`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`::error title=Develop image lane failed::${error.message}`);
    process.exit(1);
  });
}
