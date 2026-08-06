#!/usr/bin/env node
/**
 * Runs this repository's npm commands with the EXACT npm version the repository
 * declares, and asserts that the npm actually obtained IS that version.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 *
 * CI runs on a pool of long-lived, NON-EPHEMERAL, self-hosted runners.
 * `actions/setup-node` with a major-only `node-version` ('22', '24') resolves
 * to whatever patch release that particular host already has in its tool
 * cache — and the Node patch release is what decides which npm is bundled.
 * Two hosts in the same pool, answering the same `node-version`, therefore
 * hand out different npm versions. Measured: 11.6.2 on one host and 11.17.0
 * on another, on the same day, for the same declared `node-version: '24'`.
 *
 * That heterogeneity was not accidental. This repository's release job used to
 * run `npm install -g npm@latest`, which writes into the shared host's Node
 * prefix and so mutates the toolchain of every later job on that machine, in
 * every repository — and pulls a floating version, so no two runs agreed. With
 * npm 12 released, `@latest` is now an unannounced MAJOR upgrade that would
 * land in a publish job and stay on the host afterwards.
 *
 * ── WHAT THIS DOES ─────────────────────────────────────────────────────────
 *
 * The declared npm version is a SINGLE declaration in this repository's root
 * package.json, so no npm version literal lives in a workflow file and the pin
 * cannot drift between workflows. It is read from:
 *
 *   - `packageManager`, when that field declares npm — the standard field, and
 *     what the npm-managed repositories in this fleet use; otherwise
 *   - `engines.npm`, which is where a repository whose `packageManager` names a
 *     DIFFERENT package manager (this one installs with pnpm) declares the npm
 *     it nonetheless needs for the publish path.
 *
 * The declaration on its own is INERT — neither npm nor pnpm enforces it, and
 * nothing fails when the running npm disagrees with it. This script is what
 * makes it load-bearing:
 *
 *   1. it reads the declared version and rejects anything that is not an exact
 *      `<major>.<minor>.<patch>` (a range or a dist-tag would re-introduce the
 *      drift this pin removes);
 *   2. it resolves that CLI and PROVES it reports exactly that version — a
 *      resolution that yields anything else fails the job loudly instead of
 *      quietly running under a different toolchain;
 *   3. it then runs the requested npm command with that CLI.
 *
 * Nothing is installed globally. `npx --yes npm@<version>` writes only into
 * the per-user npx cache. That distinction is the whole point on a shared
 * runner: a global `npm install -g npm@…` mutates every later job on that host.
 *
 * The ambient npm is reported in the log on every run, so runner heterogeneity
 * stays VISIBLE even though it is no longer load-bearing.
 *
 * ── USAGE ──────────────────────────────────────────────────────────────────
 *
 *   node tooling/ci/npm-toolchain.mjs --check     assert only, run nothing
 *   node tooling/ci/npm-toolchain.mjs publish …   assert, then `npm publish …`
 *
 * npm runs in the CURRENT working directory, so a workflow step may set
 * `working-directory:` freely; the declared version is always read from the
 * repository root, which is located relative to this file rather than to the
 * caller's cwd.
 *
 * Zero dependencies, on purpose: it runs BEFORE any install.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..', '..');
const ROOT_MANIFEST = join(REPO_ROOT, 'package.json');

/**
 * Exact versions only. A range (`^11.17.0`, `>=11`) or a `latest` tag would
 * hand the decision back to whatever the resolver felt like today, which is
 * the drift this file exists to remove. Corepack's optional `+<integrity>`
 * suffix is accepted because it does not change which version is selected.
 */
const EXACT_VERSION = /^(\d+\.\d+\.\d+)(?:\+[A-Za-z0-9._-]+)?$/;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(ROOT_MANIFEST, 'utf8'));
  } catch (error) {
    return fail(`cannot read ${ROOT_MANIFEST}: ${error.message}`);
  }
}

/**
 * Which field declares the npm pin, and what it says.
 *
 * `packageManager` wins when it names npm. It cannot in a pnpm-managed
 * repository — that field names the ONE manager corepack activates — so
 * `engines.npm` carries the pin there instead. Exactly one of the two is
 * authoritative for any given repository; there is no merge and no precedence
 * puzzle to get wrong.
 */
function locateDeclaration(manifest) {
  const packageManager = manifest.packageManager;
  if (typeof packageManager === 'string' && packageManager.trim().startsWith('npm@')) {
    return { field: 'packageManager', value: packageManager.trim().slice('npm@'.length) };
  }

  const engineNpm = manifest.engines?.npm;
  if (typeof engineNpm === 'string' && engineNpm.trim() !== '') {
    return { field: 'engines.npm', value: engineNpm.trim() };
  }

  return fail(
    `${ROOT_MANIFEST} declares no npm version, so there is no toolchain to pin ` +
      `to. "packageManager" is ${
        typeof packageManager === 'string' ? `"${packageManager}"` : 'absent'
      }, which does not name npm, and "engines.npm" is absent. Add ` +
      '`"engines": { "npm": "<exact version>" }` — the npm this repository ' +
      'publishes with.'
  );
}

function readDeclaredNpmVersion() {
  const { field, value } = locateDeclaration(readManifest());

  const match = EXACT_VERSION.exec(value);
  if (!match) {
    fail(
      `"${field}" declares npm "${value}", which is not an exact pin. It must ` +
        'read `<major>.<minor>.<patch>`; a range or a dist-tag would let the ' +
        'runner decide the toolchain again, which is the drift this pin removes.'
    );
  }

  return match[1];
}

function pinnedNpm(version, args, options = {}) {
  return spawnSync('npx', ['--yes', `npm@${version}`, ...args], options);
}

function reportAmbientToolchain() {
  const ambient = spawnSync('npm', ['--version'], { encoding: 'utf8' });
  const version =
    ambient.status === 0 ? String(ambient.stdout).trim() : '(unavailable)';
  console.log(`node        ${process.version}`);
  console.log(`ambient npm ${version}   (the runner's own npm — not used below)`);
  return version;
}

function assertPinnedNpmResolves(version) {
  const probe = pinnedNpm(version, ['--version'], { encoding: 'utf8' });

  if (probe.error) {
    fail(
      `could not run the declared npm@${version}: ${probe.error.message}. ` +
        'The pinned CLI is fetched with `npx --yes`, so this usually means the ' +
        'runner cannot reach the registry.'
    );
  }
  if (probe.status !== 0) {
    fail(
      `resolving the declared npm@${version} exited ${probe.status}. ` +
        `stderr: ${String(probe.stderr).trim() || '(empty)'}`
    );
  }

  const reported = String(probe.stdout)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .pop();

  if (reported !== version) {
    fail(
      `toolchain drift: this repository declares npm@${version} but the ` +
        `resolved CLI reports ${reported ?? '(nothing)'}. Refusing to run with ` +
        'an npm this repository did not declare.'
    );
  }

  console.log(`pinned npm  ${version}   (declared by this repository — used below)`);
}

function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.length === 0 || (args.length === 1 && args[0] === '--check');

  const version = readDeclaredNpmVersion();
  const ambient = reportAmbientToolchain();
  assertPinnedNpmResolves(version);

  if (ambient !== version && ambient !== '(unavailable)') {
    console.log(
      `::notice::runner npm is ${ambient}, declared npm is ${version}; ` +
        'the declared one is what runs, so this difference cannot change the result.'
    );
  }

  if (checkOnly) {
    return;
  }

  const result = pinnedNpm(version, args, { stdio: 'inherit' });
  if (result.error) {
    fail(`npm@${version} ${args.join(' ')} could not start: ${result.error.message}`);
  }
  if (result.signal) {
    fail(`npm@${version} ${args.join(' ')} was killed by ${result.signal}`);
  }
  process.exit(result.status ?? 1);
}

main();
