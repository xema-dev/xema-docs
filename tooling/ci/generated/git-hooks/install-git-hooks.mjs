#!/usr/bin/env node
// GENERATED from tooling/ci/git-hooks/install-git-hooks.mjs
// source-sha256: 2c254d34b063ca9bf2b9ecc959987a13a8f819f51db3de308d945266f13e9437
// ═══════════════════════════════════════════════════════════════════════════
// `prepare` — install the lefthook git hooks, but only where hooks can exist.
//
// `prepare` runs on EVERY `pnpm install`, and one of those installs happens
// inside the service Docker image build, which has neither a `.git` directory
// (the build context excludes it) nor a `git` binary. A bare
// `"prepare": "lefthook install"` therefore fails the image build outright:
//
//     . prepare: Error: exec: "git": executable file not found in $PATH
//     ERROR: failed to solve: process "... pnpm install --offline
//            --filter ${SERVICE}... --frozen-lockfile" exit code: 1
//
// That is not a hook problem to work around — it is a category error. Git
// hooks are a property of a developer's WORKING TREE; an image build has no
// working tree to hook, so there is nothing to install and nothing has gone
// wrong. This script says exactly that, out loud, and exits 0.
//
// What it does NOT do is swallow a real failure. In an actual git work tree
// the install must succeed: a non-zero `lefthook install` propagates, because
// a developer whose pre-push hook silently failed to install is a developer
// who finds out from CI instead. The two outcomes are distinguished by a
// deterministic fact — "is there a git work tree here" — never by an `|| true`.
//
// ── WHY THIS SCRIPT RESOLVES THE BINARY ITSELF ────────────────────────────
//
// It used to `spawnSync('lefthook', …)`, i.e. rely on PATH / the caller's
// `.bin/`. Inside the AGGREGATOR checkout that is unreachable for a carved
// repository, and the failure was silent in both halves:
//
//   1. `lefthook install` bakes an ABSOLUTE path to the binary that ran it
//      into the generated hook (measured: re-running `install` from a
//      different binary rewrites that line). A carved repo's hook was baked by
//      a `pnpm install` run INSIDE that repo — the escape hatch — so it points
//      at `repos/<repo>/node_modules/.pnpm/lefthook-*/bin/lefthook`.
//   2. That store is exactly what `.claude/rules/package-store-ownership.md`
//      forbids and `tooling/dev/repair-package-stores.mjs` deletes. Afterwards
//      the baked path dangles, and every remaining fallback in lefthook's
//      generated hook misses too: lefthook is not on PATH, and a carved repo
//      root is not an aggregator workspace member, so it has no `node_modules`
//      and no `.bin/` at all.
//   3. lefthook's generated hook ends its search with
//      `echo "Can't find lefthook in PATH"` — and NO non-zero exit. So the
//      hook printed a warning and returned 0. Measured 2026-08-17: every one
//      of the ten carved repositories' `pre-push` hooks was in this state, so
//      every local push in this checkout was unguarded while LOOKING guarded.
//
// The fix is the pattern `package-store-ownership.md` already documents for
// carved root scripts: resolve by PATH-INDEPENDENT node resolution instead of
// a binary name. `createRequire(...).resolve('lefthook/bin/index.js')` walks up
// from this file — `repos/<repo>/node_modules` (absent) → the aggregator's
// `node_modules` (present) — and in a standalone clone it finds the repo's own
// copy on the first hop. Same script, both topologies, no per-machine config.
//
// ── AND WHY IT HARDENS THE GENERATED HOOK ─────────────────────────────────
//
// Resolving the binary fixes today's breakage. It does not fix the SHAPE of
// the defect: a baked absolute path can dangle again — another store repair,
// a `pnpm store prune`, a different machine, a moved checkout — and lefthook's
// template would once more warn-and-return-0. A gate whose only failure mode
// is a message nobody reads is the failure this repository names most often.
//
// So after installing, every generated hook's dead-end branch is rewritten to
// print the reason and `exit 1`. An unresolvable lefthook now REFUSES the
// push instead of waving it through; `git push --no-verify` remains the
// deliberate, visible bypass.
//
// The rewrite ASSERTS rather than assumes: the marker must be present exactly
// once in freshly generated content, and if lefthook's template ever changes
// so it is not, this fails loudly instead of leaving hooks quietly unhardened.
//
// ── AND WHY IT SWEEPS SUBMODULES ──────────────────────────────────────────
//
// A carved repository's root is not an aggregator workspace member, so its own
// `prepare` NEVER runs from an aggregator install — which is why the fix above
// would otherwise be inert in the only checkout that has the bug. The
// aggregator install already owns every `node_modules` beneath `repos/`
// (`package-store-ownership.md`); it therefore owns the hooks baked against
// them. Each submodule that carries a lefthook config gets the same install +
// hardening, from the same resolved binary.
//
// (Generated into every repo at tooling/ci/generated/git-hooks/; the repo root comes from git, not from
// this file's own location, so one byte-identical script serves every depth.)
//
// In a standalone carved clone this loop is naturally inert — those
// repositories have no submodules — so one byte-identical script serves both.
// ═══════════════════════════════════════════════════════════════════════════

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Printed with a stable prefix so the reason is greppable in build logs. */
const TAG = '[prepare:git-hooks]';


function skip(reason) {
  console.log(`${TAG} skipped — ${reason}. Nothing to install here.`);
  process.exit(0);
}

function die(message) {
  console.error(`${TAG} ${message}`);
  process.exit(1);
}

// ── 1. Is there anything to hook at all? ──────────────────────────────────
//
// `git rev-parse --git-dir` is the cheapest total answer to "is this a git
// work tree": it is non-zero outside one, and ENOENT when git is absent
// entirely. Both are the same verdict — no tree, no hooks.
const probe = spawnSync('git', ['rev-parse', '--git-dir'], { stdio: 'ignore' });

if (probe.error?.code === 'ENOENT') {
  skip('no `git` executable on PATH (image build / CI container)');
}
if (probe.error) {
  skip(`could not probe for a git work tree (${probe.error.message})`);
}
if (probe.status !== 0) {
  skip('not inside a git work tree (installed as a dependency or tarball)');
}

// ── 2. One-time migration off the hand-rolled `.husky/` directory ─────────
//
// This repository used to point `core.hooksPath` at a tracked `.husky/`, wired
// up by every developer running `git config core.hooksPath .husky` BY HAND —
// which is why almost nobody was wired up. lefthook writes into `.git/hooks`,
// and a stale `core.hooksPath` silently wins over it, so the install would
// report success while no hook ever fired.
//
// Cleared ONLY when it points at a directory that no longer exists. A
// `core.hooksPath` someone set deliberately, to somewhere real, is left alone.
const hooksPath = spawnSync('git', ['config', '--get', 'core.hooksPath'], {
  encoding: 'utf8',
});
const configured = (hooksPath.stdout ?? '').trim();
if (configured.length > 0 && !existsSync(configured)) {
  console.log(
    `${TAG} clearing core.hooksPath -> ${configured} (that directory is gone; ` +
      'it would silently win over the hooks installed below)',
  );
  const unset = spawnSync('git', ['config', '--unset', 'core.hooksPath'], {
    stdio: 'inherit',
  });
  if (unset.status !== 0) {
    die(
      'could not clear core.hooksPath. Run `git config --unset core.hooksPath` ' +
        'yourself, or the hooks below will not fire.',
    );
  }
}

// ── 3. Resolve the lefthook launcher, PATH-independently ──────────────────
//
// See the header. `lefthook`'s npm package exposes `bin/index.js`, a Node
// launcher that execs the platform binary; the binary reports its OWN absolute
// path to `lefthook install`, which is the path that gets baked into the hook.
// So resolving the launcher is enough to fix what gets baked.
const require = createRequire(import.meta.url);

let launcher;
try {
  launcher = require.resolve('lefthook/bin/index.js');
} catch {
  // Reachable when the tree was installed with `--ignore-scripts` semantics or
  // a filtered/production install that omits root devDependencies. Loud, but
  // not fatal: the hooks are a dev affordance, and the install itself is fine.
  skip('`lefthook` is not installed (root devDependencies were not installed)');
}

// ── 4. Hardening the generated hook ───────────────────────────────────────

/**
 * lefthook's dead end. Present verbatim in every hook it generates (2.1.10),
 * as the `else` arm of the binary search in `call_lefthook`. It prints and
 * falls out of the function, so the hook exits 0 and the operation proceeds
 * completely unverified.
 */
const DEAD_END = '      echo "Can\'t find lefthook in PATH"\n';

/** Proof our rewrite is already applied — makes the pass idempotent. */
const SENTINEL = '# xema:lefthook-unresolved-is-fatal';

/**
 * The replacement. Single-quoted so nothing in it is expanded by `sh`, and
 * written to stderr because that is where a refusal belongs. `exit 1` inside a
 * shell function exits the whole hook, which is exactly the intent.
 */
const REFUSAL = [
  `      ${SENTINEL}`,
  // A push whose refs are all tags grades nothing (the commit was graded when its branch was pushed),
  // so a CI tag step in a tree without lefthook must pass. Only a pre-push with piped stdin is read.
  '      if [ "$(basename "$0")" = pre-push ] && [ ! -t 0 ] && cat | awk \'NF { n++; if ($3 !~ /^refs\\/tags\\//) bad = 1 } END { exit (n == 0 || bad) }\'; then',
  '        exit 0',
  '      fi',
  "      echo 'lefthook is installed as a git hook here, but its binary cannot' >&2",
  "      echo 'be found — so THIS HOOK JUST VERIFIED NOTHING.' >&2",
  "      echo '' >&2",
  "      echo 'Refusing the operation rather than letting it through unguarded.' >&2",
  "      echo '' >&2",
  "      echo '  Fix: run `pnpm install` in the checkout that owns this tree' >&2",
  "      echo '       node_modules. That re-runs prepare, which re-bakes this' >&2",
  "      echo '       hook against a binary that exists.' >&2",
  "      echo '  Deliberate bypass: git push --no-verify' >&2",
  '      exit 1',
  '',
].join('\n');

/**
 * Rewrite one generated hook so an unresolvable lefthook is fatal.
 * @returns {'hardened'|'already'} never silently "nothing to do".
 */
function hardenHookFile(file) {
  const source = readFileSync(file, 'utf8');

  if (source.includes(SENTINEL)) return 'already';

  const occurrences = source.split(DEAD_END).length - 1;
  if (occurrences !== 1) {
    die(
      `cannot harden ${file}: expected lefthook's "can't find" branch exactly ` +
        `once, found ${occurrences}. lefthook's hook template has changed — ` +
        're-derive this rewrite rather than leaving hooks unhardened.',
    );
  }

  writeFileSync(file, source.replace(DEAD_END, REFUSAL), { mode: 0o755 });
  return 'hardened';
}

// ── 5. Install + harden, here and in every hooked submodule ───────────────

/** Absolute path to a work tree's hooks directory, per git itself. */
function hooksDirOf(cwd) {
  const out = spawnSync(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-path', 'hooks'],
    { cwd, encoding: 'utf8' },
  );
  if (out.status !== 0) return null;
  const dir = (out.stdout ?? '').trim();
  return dir.length > 0 ? dir : null;
}

function installIn(cwd, label) {
  const install = spawnSync(process.execPath, [launcher, 'install'], {
    cwd,
    stdio: 'inherit',
  });

  if (install.error) {
    die(`failed to run \`lefthook install\` in ${label}: ${install.error.message}`);
  }
  if (install.status !== 0) {
    die(
      `\`lefthook install\` exited ${install.status} in ${label}. Git hooks are ` +
        'NOT installed; fix this rather than pushing without them.',
    );
  }

  const dir = hooksDirOf(cwd);
  if (dir === null || !existsSync(dir)) {
    die(`\`lefthook install\` reported success in ${label} but ${dir ?? 'its hooks directory'} does not exist.`);
  }

  // Harden every hook lefthook generated — identified by the search function
  // it writes, so a pre-existing hand-written hook is never touched.
  let hardened = 0;
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.sample')) continue;
    const file = join(dir, name);
    if (!statSync(file).isFile()) continue;
    const body = readFileSync(file, 'utf8');
    if (!body.includes('call_lefthook')) continue;
    if (hardenHookFile(file) === 'hardened') hardened += 1;
  }

  if (hardened > 0) {
    console.log(`${TAG} ${label}: hardened ${hardened} hook(s) — an unresolvable lefthook now exits 1.`);
  }
}

installIn(process.cwd(), '.');

// `--cwd-only`: install into the current work tree with this checkout's lefthook and stop. Used by
// `land-queue` to hook a carved repo's integration clone, which is not an aggregator submodule.
if (process.argv.includes('--cwd-only')) process.exit(0);

// Submodules that carry their own lefthook config. Read from `.gitmodules`
// rather than `git submodule foreach`, which would spawn a shell per entry
// across a 28-submodule tree for a question two greps answer.
const CONFIGS = ['lefthook.yml', 'lefthook.yaml', '.lefthook.yml', '.lefthook.yaml'];

const toplevel = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout.trim();
const gitmodules = resolve(toplevel, '.gitmodules');
if (existsSync(gitmodules)) {
  const listed = spawnSync(
    'git',
    ['config', '--file', gitmodules, '--get-regexp', String.raw`^submodule\..*\.path$`],
    { encoding: 'utf8' },
  );

  // Exit 1 means "no matching keys", which is a legitimate empty answer.
  if (listed.status !== 0 && listed.status !== 1) {
    die(`could not read submodule paths from ${gitmodules} (exit ${listed.status}).`);
  }

  const paths = (listed.stdout ?? '')
    .split('\n')
    .map((line) => line.split(' ').slice(1).join(' ').trim())
    .filter((p) => p.length > 0);

  for (const rel of paths) {
    const dir = resolve(dirname(gitmodules), rel);
    if (!CONFIGS.some((name) => existsSync(join(dir, name)))) continue;
    // An uninitialised submodule is an empty directory, not a work tree.
    if (spawnSync('git', ['rev-parse', '--git-dir'], { cwd: dir, stdio: 'ignore' }).status !== 0) {
      console.log(`${TAG} ${rel}: not initialised — skipping (run \`git submodule update --init\`).`);
      continue;
    }
    installIn(dir, rel);
  }
}
