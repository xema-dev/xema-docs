// =============================================================================
// docs-api — the public documentation content server.
//
// Reads the markdown docs in `content/` (this repo is the single source of
// truth for Xema public docs) and serves them as JSON for the host-web
// in-app docs viewer (`xema.dev/docs`) and for any other consumer
// (e.g. xema-shell-api's concept registry).
//
// Endpoints (all public, read-only):
//   GET /api/docs/tree                  -> DocTreeNode[]
//   GET /api/docs/content?path=<slug>   -> { content, path }
//   GET /health/live                    -> { status: 'ok' }
//   GET /health/ready                   -> { status: 'ok' } | 503
//
// Intentionally ZERO npm dependencies — the job is "read markdown, return
// JSON", so it runs on Node built-ins only. No framework, no platform
// toolchain. Keep it that way.
// =============================================================================

import { createServer } from 'node:http';
import { readFile, readdir, access } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKDOWN_EXTENSION = '.md';
// `README.md` is repo-authoring meta, not a published doc page. Excluded
// from both the tree and the content endpoint so it never surfaces in the
// viewer.
const EXCLUDED_FILENAMES = new Set(['README.md']);

const PORT = Number(process.env.PORT ?? 3000);

/**
 * Absolute path to the markdown root we serve. Defaults to the sibling
 * `content/` dir (so `node service/server.mjs` works from a checkout);
 * the container image overrides it via DOCS_SOURCE_DIR.
 */
const DOCS_SOURCE_DIR = resolve(
  process.env.DOCS_SOURCE_DIR ??
    fileURLToPath(new URL('../content', import.meta.url)),
);

// ── tree + naming ────────────────────────────────────────────────────────────

/** Sort key: a directory's own `index.md` sorts first, then by name. */
function sortKey(name) {
  return name === `index${MARKDOWN_EXTENSION}` ? '' : name.toLowerCase();
}

/**
 * Human label for a tree node, derived deterministically from the file or
 * directory name: drop the extension and any leading `NN-` ordering prefix,
 * turn separators into spaces, and title-case. `index` becomes "Overview".
 */
function cleanName(rawName) {
  const base = rawName.endsWith(MARKDOWN_EXTENSION)
    ? rawName.slice(0, -MARKDOWN_EXTENSION.length)
    : rawName;
  if (base === 'index') return 'Overview';
  const stripped = base
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (stripped === '') return 'Overview';
  return stripped.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Slug = path relative to the docs root, POSIX separators, no `.md`. */
function toSlug(absPath) {
  const rel = relative(DOCS_SOURCE_DIR, absPath).split(sep).join('/');
  return rel.endsWith(MARKDOWN_EXTENSION)
    ? rel.slice(0, -MARKDOWN_EXTENSION.length)
    : rel;
}

async function buildTree(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const sorted = [...entries].sort((a, b) =>
    sortKey(a.name).localeCompare(sortKey(b.name)),
  );

  const nodes = [];
  for (const entry of sorted) {
    if (entry.isDirectory()) {
      const childDir = join(dir, entry.name);
      const children = await buildTree(childDir);
      if (children.length === 0) continue; // skip empty dirs
      nodes.push({
        name: cleanName(entry.name),
        slug: toSlug(childDir),
        type: 'dir',
        children,
      });
    } else if (
      entry.isFile() &&
      entry.name.endsWith(MARKDOWN_EXTENSION) &&
      !EXCLUDED_FILENAMES.has(entry.name)
    ) {
      const filePath = join(dir, entry.name);
      nodes.push({
        name: cleanName(entry.name),
        slug: toSlug(filePath),
        type: 'file',
      });
    }
  }
  return nodes;
}

// ── content ──────────────────────────────────────────────────────────────────

class BadRequestError extends Error {}
class NotFoundError extends Error {}

/**
 * Resolve a request slug to an absolute markdown path, fail-fast on a path
 * that would escape the docs root (traversal guard).
 */
function resolveMarkdownPath(slug) {
  if (typeof slug !== 'string' || slug.trim() === '') {
    throw new BadRequestError('Query param "path" is required.');
  }
  if (slug.includes('\0')) {
    throw new BadRequestError('Invalid path.');
  }
  const candidate = resolve(DOCS_SOURCE_DIR, `${slug}${MARKDOWN_EXTENSION}`);
  const rootWithSep = DOCS_SOURCE_DIR.endsWith(sep)
    ? DOCS_SOURCE_DIR
    : `${DOCS_SOURCE_DIR}${sep}`;
  if (!candidate.startsWith(rootWithSep)) {
    throw new BadRequestError('Path escapes documentation root.');
  }
  return candidate;
}

async function getContent(slug) {
  const filePath = resolveMarkdownPath(slug);
  try {
    const content = await readFile(filePath, 'utf8');
    return { content, path: slug };
  } catch (err) {
    if (isMissingFileError(err)) {
      throw new NotFoundError(`Doc not found: ${slug}`);
    }
    throw err;
  }
}

function isMissingFileError(err) {
  const code = err && typeof err === 'object' ? err.code : undefined;
  return code === 'ENOENT' || code === 'EISDIR' || code === 'ENOTDIR';
}

// ── http ─────────────────────────────────────────────────────────────────────

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    // Public, read-only docs — safe to allow any origin (the in-app viewer
    // is served from a different host than docs-api).
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'public, max-age=60',
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  void handle(req, res).catch((err) => {
    process.stderr.write(`[docs-api] unhandled error: ${String(err)}\n`);
    if (!res.headersSent) {
      send(res, 500, { error: 'Internal server error' });
    }
  });
});

async function handle(req, res) {
  const method = req.method ?? 'GET';
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  if (method === 'OPTIONS') {
    return send(res, 204, {});
  }
  if (method !== 'GET') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  if (path === '/health/live') {
    return send(res, 200, { status: 'ok' });
  }
  if (path === '/health/ready') {
    try {
      await access(DOCS_SOURCE_DIR);
    } catch {
      return send(res, 503, {
        status: 'unavailable',
        reason: `docs source dir not accessible: ${DOCS_SOURCE_DIR}`,
      });
    }
    return send(res, 200, { status: 'ok' });
  }

  if (path === '/api/docs/tree') {
    const tree = await buildTree(DOCS_SOURCE_DIR);
    return send(res, 200, tree);
  }

  if (path === '/api/docs/content') {
    try {
      const result = await getContent(url.searchParams.get('path') ?? '');
      return send(res, 200, result);
    } catch (err) {
      if (err instanceof BadRequestError) {
        return send(res, 400, { error: err.message });
      }
      if (err instanceof NotFoundError) {
        return send(res, 404, { error: err.message });
      }
      throw err;
    }
  }

  return send(res, 404, { error: 'Not found' });
}

server.listen(PORT, () => {
  process.stdout.write(
    `[docs-api] listening on :${PORT} (source: ${DOCS_SOURCE_DIR})\n`,
  );
});
