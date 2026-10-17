#!/usr/bin/env node
// GENERATED from tooling/ci/git-hooks/pre-push.mjs
// source-sha256: 8b76066885df38248e23f8dc2cf20f7e062cd7485b05d58e8fd3765aed566d0c
// The one pre-push hook of every Xema repository (generated into each repo from the aggregator's
// tooling/ci/git-hooks/pre-push.mjs; edit the source, never a copy).
//
// It grades the commit being PUSHED, not the working tree. For each pushed branch ref, in order,
// stopping at the first failure:
//   1. lockfile derivable  pnpm install --frozen-lockfile | npm ci   (a lockfile that disagrees with the manifests fails here)
//   2. gitlinks            every gitlink of the pushed commit is an ancestor of the submodule's origin/<branch being pushed>
//                          (aggregator only: then the mirror files those gitlink moves deliver are reproducible from their producers)
//   3. gate                pnpm check | npm run check
// Nothing else: it never resolves against a registry for newer builds (the push commands do that).
//
// Tree: the working tree itself when it is clean and HEAD is the pushed sha (and the repo is not a
// checkout inside an aggregator, whose node_modules the aggregator owns); otherwise a `git archive`
// export of the pushed sha into a scratch directory this hook creates and deletes, with
// TURBO_CACHE_DIR pointed at the repo's own turbo cache. No git worktrees.
//
// Every failure prints the cause and the one command that fixes it. "Could not run" (no network, a
// missing tool) is a refusal that names what was missing, never a pass.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ZERO_SHA = /^0+$/;
const PARK_PREFIX = 'refs/xema-session/';
const GIT_VARS = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_PREFIX',
];

/** A refusal: the push is stopped. `fix` is the one command (or sentence) that resolves it. */
export class Refusal extends Error {
  constructor(step, cause, fix) {
    super(cause);
    this.step = step;
    this.fix = fix;
  }
}

/** Git exports GIT_DIR and friends into a hook's environment; they outrank the cwd. */
export function hookEnv(base = process.env) {
  const env = { ...base, GIT_TERMINAL_PROMPT: '0', COREPACK_ENABLE_STRICT: '0' };
  for (const name of GIT_VARS) delete env[name];
  env.GIT_SSH_COMMAND ??= 'ssh -oBatchMode=yes -oConnectTimeout=10';
  return env;
}

/** `<local ref> <local sha> <remote ref> <remote sha>` per line. Deletions, session parks and tags are not graded: a tag names a commit already graded when its branch was pushed. */
export function parseRefs(stdin) {
  const refs = [];
  for (const line of stdin.split('\n')) {
    const [localRef, sha, remoteRef, remoteSha] = line.trim().split(/\s+/);
    if (!sha || !/^[0-9a-f]{40,64}$/.test(sha) || ZERO_SHA.test(sha)) continue;
    if (remoteRef?.startsWith(PARK_PREFIX) || remoteRef?.startsWith('refs/tags/')) continue;
    refs.push({ localRef, sha, remoteRef, remoteSha });
  }
  return refs;
}

/**
 * A ref restoration (tooling/dev/restore-ref.mjs) re-points a ref at a commit that is already published,
 * so it delivers no content and there is nothing to grade. Asserted by env, and re-validated here: the
 * named sha must be exactly what every ref pushes, and every ref must be a create.
 */
export function isRestoration(refs, env = process.env) {
  const sha = env.XEMA_REF_RESTORE_SHA ?? '';
  if (!/^[0-9a-f]{40,64}$/.test(sha) || refs.length === 0) return false;
  const ref = env.XEMA_REF_RESTORE_REF ?? '';
  return refs.every((r) => r.sha === sha && (!r.remoteSha || ZERO_SHA.test(r.remoteSha)) && (ref === '' || r.remoteRef === ref));
}

/** The branch a push lands on, or null for a ref that is not a branch (a tag). */
export function targetBranch(remoteRef) {
  return remoteRef?.startsWith('refs/heads/') ? remoteRef.slice('refs/heads/'.length) : null;
}

/** pnpm repos have pnpm-lock.yaml, npm repos package-lock.json. */
export function packageManager(tree) {
  if (existsSync(path.join(tree, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(path.join(tree, 'package-lock.json'))) return 'npm';
  throw new Refusal('lockfile', 'the pushed commit has neither pnpm-lock.yaml nor package-lock.json', 'pnpm install   (then commit the lockfile)');
}

const NETWORK = /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|ENETUNREACH|EHOSTUNREACH|ERR_PNPM_FETCH_|ERR_PNPM_META_FETCH_FAIL|Could not resolve host|network/iu;
const OUTDATED = /ERR_PNPM_OUTDATED_LOCKFILE|ERR_PNPM_LOCKFILE_CONFIG_MISMATCH|ERR_PNPM_NO_LOCKFILE|not up to date with|in sync|lock file's .* does not satisfy|cannot install with/iu;

/** Classify a failed install: a lockfile that disagrees with the manifests, an unreachable registry, or other. */
export function classifyInstallFailure(output, pm) {
  const relock = pm === 'pnpm' ? 'pnpm install   (then commit pnpm-lock.yaml)' : 'npm install   (then commit package-lock.json)';
  if (OUTDATED.test(output)) {
    return new Refusal('lockfile', `the lockfile does not match the manifests of the pushed commit (${pm})`, relock);
  }
  if (NETWORK.test(output)) {
    return new Refusal('lockfile', 'could not run: the registry is unreachable, so the install of the pushed commit could not be checked', 'restore the network (or the registry), then push again');
  }
  const tail = output.trim().split('\n').slice(-12).join('\n');
  return new Refusal('lockfile', `the install of the pushed commit failed:\n${tail}`, `${pm === 'pnpm' ? 'pnpm install --frozen-lockfile' : 'npm ci'}   (reproduce in a clean clone of the pushed commit)`);
}

function sh(command, args, options) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
  if (result.error?.code === 'ENOENT') {
    throw new Refusal('tool', `could not run: \`${command}\` is not installed or not on PATH`, `install ${command}, then push again`);
  }
  if (result.error) throw new Refusal('tool', `could not run \`${command}\`: ${result.error.message}`, 'push again');
  return result;
}

function git(root, args, env) {
  return sh('git', args, { cwd: root, env });
}

/** Every gitlink (mode 160000) of a commit: `[{ path, sha }]`. */
export function gitlinksOf(root, sha, env) {
  const tree = git(root, ['ls-tree', '-r', '-z', sha], env);
  if (tree.status !== 0) throw new Refusal('gitlinks', `cannot read the tree of ${sha}: ${tree.stderr.trim()}`, 'git fetch   (the pushed commit must exist locally)');
  return tree.stdout
    .split('\0')
    .filter(Boolean)
    .map((entry) => /^160000 commit ([0-9a-f]+)\t(.*)$/su.exec(entry))
    .filter(Boolean)
    .map((m) => ({ sha: m[1], path: m[2] }));
}

/** Refuse when a gitlink of the pushed commit is not an ancestor of the submodule's origin/<branch>. */
export function checkGitlinks(root, sha, branch, env) {
  for (const link of gitlinksOf(root, sha, env)) {
    const sub = path.join(root, link.path);
    if (!existsSync(path.join(sub, '.git'))) {
      throw new Refusal('gitlinks', `submodule ${link.path} is not checked out, so its gitlink ${link.sha.slice(0, 10)} cannot be checked`, `git submodule update --init ${link.path}`);
    }
    const spec = `+refs/heads/${branch}:refs/remotes/origin/${branch}`;
    const fetched = git(sub, ['fetch', '--quiet', 'origin', spec], env);
    if (fetched.status !== 0) {
      const text = fetched.stderr.trim();
      if (/couldn't find remote ref/u.test(text)) {
        throw new Refusal('gitlinks', `${link.path} has no branch '${branch}' on its origin, so gitlink ${link.sha.slice(0, 10)} cannot be on it`, `push ${link.path} to ${branch} first: git -C ${link.path} push origin ${link.sha}:refs/heads/${branch}`);
      }
      throw new Refusal('gitlinks', `could not run: cannot fetch origin/${branch} of ${link.path} (${text.split('\n').pop()})`, 'restore the network, then push again');
    }
    const present = git(sub, ['cat-file', '-e', `${link.sha}^{commit}`], env).status === 0;
    const onBranch = present && git(sub, ['merge-base', '--is-ancestor', link.sha, `refs/remotes/origin/${branch}`], env).status === 0;
    if (!onBranch) {
      throw new Refusal('gitlinks', `${link.path} gitlink ${link.sha.slice(0, 10)} is not on origin/${branch} of that submodule`, `push ${link.path} first: git -C ${link.path} push origin ${link.sha}:refs/heads/${branch}`);
    }
  }
}

/** Export the pushed sha (and its gitlinked submodules) into `<scratch>/tree`; returns { scratch, tree }. */
export function exportTree(root, sha, env) {
  const scratch = mkdtempSync(path.join(tmpdir(), 'xema-prepush-'));
  const tree = path.join(scratch, 'tree');
  try {
    const unpack = (cwd, rev, into, name) => {
      const tar = path.join(scratch, `${name}.tar`);
      const made = git(cwd, ['archive', '--format=tar', '-o', tar, rev], env);
      if (made.status !== 0) throw new Refusal('export', `cannot export ${rev} of ${path.relative(root, cwd) || '.'}: ${made.stderr.trim()}`, 'git fetch   (the pushed commit must exist locally)');
      mkdirSync(into, { recursive: true });
      const extracted = sh('tar', ['-x', '-f', tar, '-C', into]);
      if (extracted.status !== 0) throw new Refusal('export', `cannot unpack the export: ${extracted.stderr.trim()}`, 'free disk space in the temp directory');
      rmSync(tar, { force: true });
    };
    unpack(root, sha, tree, 'root');
    let n = 0;
    for (const link of gitlinksOf(root, sha, env)) {
      const sub = path.join(root, link.path);
      if (!existsSync(path.join(sub, '.git'))) continue; // checkGitlinks refuses an uninitialised one first
      unpack(sub, link.sha, path.join(tree, link.path), `sub${n++}`);
    }
    return { scratch, tree };
  } catch (error) {
    rmSync(scratch, { recursive: true, force: true });
    throw error;
  }
}

/** The tree to grade for one pushed sha: in place, or an export. */
export function chooseTree(root, sha, env) {
  const ask = (args) => {
    const r = git(root, args, env);
    if (r.status !== 0) throw new Refusal('tree', `git ${args.join(' ')} failed (${(r.stderr || '').trim() || `exit ${r.status}`}), so the tree cannot be judged clean`, 'fix the repository state git names, then push again');
    return r.stdout.trim();
  };
  const head = ask(['rev-parse', 'HEAD']);
  const dirty = ask(['status', '--porcelain']) !== '';
  const nested = ask(['rev-parse', '--show-superproject-working-tree']) !== '';
  if (!dirty && head === sha && !nested) return { inPlace: true, tree: root, scratch: null, why: 'clean tree at the pushed commit' };
  const why = nested
    ? 'this checkout sits inside an aggregator, whose install owns node_modules'
    : head !== sha
      ? 'HEAD is not the pushed commit'
      : 'the working tree is dirty';
  return { inPlace: false, ...exportTree(root, sha, env), why };
}

/**
 * Install the tree, which proves the lockfile matches the manifests. A tree with gitlinks is an aggregator:
 * its install is the whole fleet's, so only the lockfile is proved (`--lockfile-only --frozen-lockfile`
 * fetches and builds nothing).
 */
function installTree(tree, pm, env, lockfileOnly = false) {
  let args = pm === 'pnpm' ? ['install', '--frozen-lockfile', '--prefer-offline'] : ['ci', '--prefer-offline'];
  if (lockfileOnly) args = pm === 'pnpm' ? ['install', '--lockfile-only', '--frozen-lockfile'] : ['install', '--package-lock-only', '--ignore-scripts'];
  const result = sh(pm, args, { cwd: tree, env });
  if (result.status !== 0) throw classifyInstallFailure(`${result.stdout}\n${result.stderr}`, pm);
}

/**
 * The aggregator's gitlink extension: the frontend-bridge mirror files a gitlink move delivers must be
 * reproducible from the producer's branch. Present only where the file is (the aggregator).
 */
function checkMirror(root, ref, env) {
  const script = path.join(root, 'tooling/ci/git-hooks/frontend-mirror.mjs');
  if (!existsSync(script)) return;
  const result = sh(process.execPath, [script, ref.sha, ref.remoteRef, ref.remoteSha ?? ''], { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Refusal('mirror', 'the frontend-bridge mirror files this push delivers are not reproducible from their producers (output above)', 'push the producer first, or re-sync the mirror: pnpm sync:frontend, commit it in xema-host-web, advance the gitlink');
  }
}

function runGate(tree, pm, env) {
  const args = pm === 'pnpm' ? ['check'] : ['run', 'check'];
  const result = sh(pm, args, { cwd: tree, env, stdio: 'inherit' });
  if (result.status !== 0) {
    const again = `${pm} ${args.join(' ')}`;
    let hasFix = false;
    try { hasFix = typeof JSON.parse(readFileSync(path.join(tree, 'package.json'), 'utf8')).scripts?.fix === 'string'; } catch { /* no readable manifest: name no fix script */ }
    const fixCmd = pm === 'pnpm' ? 'pnpm fix' : 'npm run fix';
    throw new Refusal('gate', `\`${again}\` failed on the pushed commit (output above)`, hasFix ? `${fixCmd}   (if the failure is derivable), otherwise fix it and run \`${again}\`` : `fix the failure above, then run \`${again}\``);
  }
}

/** Grade one pushed ref; throws Refusal. */
export function gradeRef(root, ref, env, log = console.log) {
  const branch = targetBranch(ref.remoteRef);
  if (branch === null) {
    log(`pre-push: ${ref.remoteRef} is not a branch; nothing to grade.`);
    return;
  }
  const short = ref.sha.slice(0, 10);
  const chosen = chooseTree(root, ref.sha, env);
  log(`pre-push: grading ${short} for ${branch} ${chosen.inPlace ? 'in place' : `from an export (${chosen.why})`}`);
  const gateEnv = chosen.inPlace ? env : { ...env, TURBO_CACHE_DIR: path.join(root, '.turbo', 'cache') };
  const cleanup = () => {
    if (chosen.scratch) rmSync(chosen.scratch, { recursive: true, force: true });
  };
  const onSignal = () => {
    cleanup();
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    const pm = packageManager(chosen.tree);
    const links = gitlinksOf(root, ref.sha, env);
    const hasGitlinks = links.length > 0;
    // The lockfile of an aggregator is derived from its submodules' manifests: a missing one would silently drop its importers.
    const missing = links.filter((l) => !existsSync(path.join(root, l.path, '.git'))).map((l) => l.path);
    if (missing.length > 0) {
      throw new Refusal('gitlinks', `${missing.length} submodule(s) are not checked out (${missing.slice(0, 4).join(', ')}${missing.length > 4 ? ', ...' : ''}), so the lockfile and gitlinks of the pushed commit cannot be checked`, 'git submodule update --init');
    }
    installTree(chosen.tree, pm, gateEnv, hasGitlinks);
    checkGitlinks(root, ref.sha, branch, env);
    if (hasGitlinks) checkMirror(root, ref, env);
    runGate(chosen.tree, pm, gateEnv);
  } finally {
    cleanup();
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }
}

export function main(stdin, log = console.log) {
  const started = Date.now();
  const env = hookEnv();
  let root;
  try {
    const top = sh('git', ['rev-parse', '--show-toplevel'], { env });
    if (top.status !== 0) throw new Refusal('repo', 'not inside a git repository', 'run the push from the repository');
    root = realpathSync(top.stdout.trim());
    const refs = parseRefs(stdin);
    if (refs.length === 0) {
      log('pre-push: nothing to grade (no pushed branch commit on stdin).');
      return 0;
    }
    if (isRestoration(refs)) {
      log(`pre-push: ref restoration of ${refs[0].remoteRef} to the already-published ${refs[0].sha.slice(0, 10)}; it delivers no content, so nothing is graded.`);
      return 0;
    }
    for (const ref of refs) gradeRef(root, ref, env, log);
    log(`pre-push: GREEN in ${((Date.now() - started) / 1000).toFixed(1)}s (${refs.length} ref(s)).`);
    return 0;
  } catch (error) {
    if (!(error instanceof Refusal)) throw error;
    console.error(`pre-push: REFUSED at ${error.step}: ${error.message}`);
    console.error(`pre-push: fix: ${error.fix}`);
    return 1;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.stdin.isTTY ? '' : readFileSync(0, 'utf8'));
}
