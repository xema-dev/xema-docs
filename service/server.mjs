// =============================================================================
// docs-api — the public documentation content server.
//
// Reads the markdown docs in `content/` (this repo is the single source of
// truth for Xema public docs) and serves them as JSON for the host-web
// in-app docs viewer (`xema.dev/docs`) and for any other consumer
// (e.g. xema-shell-api's concept registry).
//
// Endpoints (all public, read-only):
//   GET /api/docs                  -> Swagger UI (API_STANDARDS §1: /api is Swagger-only)
//   GET /api/openapi.json          -> OpenAPI 3 spec
//   GET /tree                      -> DocTreeNode[]
//   GET /content?path=<slug>       -> { content, path, frontmatter }
//   GET /health/live               -> { status: 'ok' }
//   GET /health/ready              -> { status: 'ok' } | 503
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
 * Split optional leading YAML frontmatter from a markdown body. Some pages
 * (e.g. xema-os/concepts/*) carry `--- … ---` frontmatter that downstream
 * services parse; the docs viewer must NOT render it. We return the body for
 * display plus the raw frontmatter text (no fences) so a metadata consumer
 * can parse it. Zero-dep: pure string slicing, no YAML parser here.
 */
function separateFrontmatter(raw) {
  const normalized = raw.replace(/^﻿/, '');
  if (!/^---\r?\n/.test(normalized)) {
    return { frontmatter: '', body: raw };
  }
  const afterOpen = normalized.replace(/^---\r?\n/, '');
  const closeIdx = afterOpen.search(/^---\r?\n/m);
  if (closeIdx === -1) {
    return { frontmatter: '', body: raw }; // no closing fence → not frontmatter
  }
  const frontmatter = afterOpen.slice(0, closeIdx);
  const body = afterOpen.slice(closeIdx).replace(/^---\r?\n/, '');
  return { frontmatter, body };
}

/**
 * Resolve a request slug to the ordered markdown candidates to try, fail-fast
 * on a path that would escape the docs root (traversal guard).
 *
 * A slug names either a page file (`<slug>.md`) or a section directory whose
 * landing page is its `index.md` (`<slug>/index.md`). Section links in the
 * docs are authored as `./section/`, which arrives here as the BARE directory
 * slug — so a slug with no `<slug>.md` MUST fall back to `<slug>/index.md`
 * (the standard "a directory URL serves its index" rule). Without it every
 * section-landing link 404s.
 *
 * Each candidate carries the `canonicalSlug` of the file it would serve — for
 * a directory slug that is `<slug>/index`, so the viewer can resolve the
 * page's relative links against the right directory rather than the docs root.
 */
function resolveMarkdownCandidates(slug) {
  if (typeof slug !== 'string' || slug.trim() === '') {
    throw new BadRequestError('Query param "path" is required.');
  }
  if (slug.includes('\0')) {
    throw new BadRequestError('Invalid path.');
  }
  const rootWithSep = DOCS_SOURCE_DIR.endsWith(sep)
    ? DOCS_SOURCE_DIR
    : `${DOCS_SOURCE_DIR}${sep}`;
  const candidates = [
    {
      absPath: resolve(DOCS_SOURCE_DIR, `${slug}${MARKDOWN_EXTENSION}`),
      canonicalSlug: slug,
    },
    {
      absPath: resolve(DOCS_SOURCE_DIR, slug, `index${MARKDOWN_EXTENSION}`),
      canonicalSlug: `${slug}/index`,
    },
  ];
  for (const { absPath } of candidates) {
    if (!absPath.startsWith(rootWithSep)) {
      throw new BadRequestError('Path escapes documentation root.');
    }
  }
  return candidates;
}

async function getContent(slug) {
  const candidates = resolveMarkdownCandidates(slug);
  for (const { absPath, canonicalSlug } of candidates) {
    let raw;
    try {
      raw = await readFile(absPath, 'utf8');
    } catch (err) {
      // Only a missing candidate falls through to the next; a real read error
      // (permissions, etc.) propagates — no silent degradation.
      if (isMissingFileError(err)) continue;
      throw err;
    }
    const { frontmatter, body } = separateFrontmatter(raw);
    // `content` is the display body (frontmatter stripped); `frontmatter` is
    // the raw YAML text for metadata consumers (empty when there is none);
    // `path` is the canonical slug of the file actually served.
    return { content: body, path: canonicalSlug, frontmatter };
  }
  throw new NotFoundError(`Doc not found: ${slug}`);
}

function isMissingFileError(err) {
  const code = err && typeof err === 'object' ? err.code : undefined;
  return code === 'ENOENT' || code === 'EISDIR' || code === 'ENOTDIR';
}

// ── OpenAPI / Swagger ─────────────────────────────────────────────────────────
// API_STANDARDS.md §1 requires Swagger at /api/docs + the spec at
// /api/openapi.json for every service. docs-api is not a NestJS service (the
// Nest-plugin / Orval codegen sub-rules don't apply — its frontend client is
// hand-written), so the spec is authored here by hand and kept in sync with the
// handlers above.

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'Docs API',
    version: '1.0.0',
    description:
      'Serves the Xema public documentation — the Markdown under `content/` in ' +
      'the xema-docs repo (the single source of truth for public docs) — as ' +
      'JSON. Consumed by the host-web docs viewer at xema.dev/docs and by ' +
      'xema-shell-api (concept registry). Read-only and unauthenticated.',
  },
  servers: [
    { url: 'https://docs-api.xema.dev', description: 'Production' },
    { url: 'http://localhost:3000', description: 'Local' },
  ],
  tags: [
    { name: 'docs', description: 'Documentation tree and page content.' },
    { name: 'health', description: 'Kubernetes liveness/readiness probes.' },
  ],
  paths: {
    '/tree': {
      get: {
        tags: ['docs'],
        operationId: 'docs_getTree',
        summary: 'Get the documentation navigation tree',
        description:
          'Returns the full documentation tree derived from the `content/` ' +
          'directory layout. Directories become `dir` nodes (with `children`); ' +
          'Markdown files become `file` nodes. `README.md` files are excluded, ' +
          "and a directory's `index.md` sorts first.",
        responses: {
          200: {
            description: 'The documentation tree.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DocTreeNode' },
                },
                example: [
                  { name: 'Overview', slug: 'index', type: 'file' },
                  {
                    name: 'Databases',
                    slug: 'databases',
                    type: 'dir',
                    children: [
                      {
                        name: 'Concepts',
                        slug: 'databases/01-concepts',
                        type: 'file',
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
    '/content': {
      get: {
        tags: ['docs'],
        operationId: 'docs_getContent',
        summary: 'Get a documentation page by slug',
        description:
          'Returns the Markdown body for a page. The slug is the path under ' +
          '`content/` without the `.md` extension (e.g. `databases/01-concepts`, ' +
          'or `index` for the home page). Any YAML frontmatter is separated: ' +
          '`content` is the display body, `frontmatter` is the raw frontmatter ' +
          'text (empty when none). Paths that escape the docs root are rejected.',
        parameters: [
          {
            name: 'path',
            in: 'query',
            required: true,
            description: 'Page slug — path under `content/` without `.md`.',
            schema: { type: 'string', example: 'databases/01-concepts' },
          },
        ],
        responses: {
          200: {
            description: 'The page content.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DocContent' },
                example: {
                  content: '# Concepts\n\nOrg-managed relational databases…',
                  path: 'databases/01-concepts',
                  frontmatter: '',
                },
              },
            },
          },
          400: {
            description: 'Missing/invalid `path`, or a path escaping the docs root.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { error: 'Query param "path" is required.' },
              },
            },
          },
          404: {
            description: 'No page exists for the slug.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
                example: { error: 'Doc not found: nope/nope' },
              },
            },
          },
        },
      },
    },
    '/health/live': {
      get: {
        tags: ['health'],
        operationId: 'health_live',
        summary: 'Liveness probe',
        description: 'Returns 200 while the process is running.',
        responses: {
          200: {
            description: 'Alive.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthStatus' },
                example: { status: 'ok' },
              },
            },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        tags: ['health'],
        operationId: 'health_ready',
        summary: 'Readiness probe',
        description:
          'Returns 200 when the docs source directory is readable, else 503.',
        responses: {
          200: {
            description: 'Ready.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthStatus' },
                example: { status: 'ok' },
              },
            },
          },
          503: {
            description: 'Docs source directory not accessible.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthStatus' },
                example: {
                  status: 'unavailable',
                  reason: 'docs source dir not accessible: /app/content',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      DocNodeType: {
        type: 'string',
        enum: ['file', 'dir'],
        description: 'Whether a tree node is a Markdown file or a directory.',
      },
      DocTreeNode: {
        type: 'object',
        required: ['name', 'slug', 'type'],
        properties: {
          name: {
            type: 'string',
            description:
              'Display label (numeric prefix stripped, title-cased; `index` → "Overview").',
            example: 'Concepts',
          },
          slug: {
            type: 'string',
            description:
              'Path under `content/` without `.md`; used as `path` for the content endpoint.',
            example: 'databases/01-concepts',
          },
          type: { $ref: '#/components/schemas/DocNodeType' },
          children: {
            type: 'array',
            description: 'Child nodes (present on `dir` nodes only).',
            items: { $ref: '#/components/schemas/DocTreeNode' },
          },
        },
      },
      DocContent: {
        type: 'object',
        required: ['content', 'path', 'frontmatter'],
        properties: {
          content: {
            type: 'string',
            description: 'Markdown body with any YAML frontmatter removed.',
            example: '# Concepts\n\nOrg-managed relational databases…',
          },
          path: {
            type: 'string',
            description: 'The requested slug.',
            example: 'databases/01-concepts',
          },
          frontmatter: {
            type: 'string',
            description:
              'Raw YAML frontmatter text (no fences); empty string when the page has none.',
            example: '',
          },
        },
      },
      HealthStatus: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            description: 'Probe status (`ok` or `unavailable`).',
            example: 'ok',
          },
          reason: {
            type: 'string',
            description: 'Failure detail (readiness 503 only).',
            example: 'docs source dir not accessible: /app/content',
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'string',
            description: 'Human-readable error message.',
            example: 'Doc not found: nope/nope',
          },
        },
      },
    },
  },
};

// Swagger UI is a single HTML page that loads swagger-ui-dist from a CDN —
// keeps docs-api dependency-free while satisfying "/api/docs renders the API".
const SWAGGER_UI_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Docs API — API reference</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger-ui' });
      };
    </script>
  </body>
</html>`;

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

function sendHtml(res, status, html) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=300',
  });
  res.end(html);
}

const server = createServer((req, res) => {
  void handle(req, res).catch((err) => {
    process.stderr.write(`[docs-api] unhandled error: ${String(err)}\n`);
    if (!res.headersSent) {
      send(res, 500, { error: 'Internal server error' });
    }
  });
});

async function handleReady(res) {
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

async function handleContent(res, url) {
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

// Static (no-arg) GET routes. Content routes live OFF the `/api` prefix
// (API_STANDARDS §1 reserves `/api` for Swagger only); the viewer (host-web)
// and the concept registry (xema-shell-api) both consume `/tree` + `/content`.
const STATIC_ROUTES = {
  '/health/live': (res) => send(res, 200, { status: 'ok' }),
  '/api/openapi.json': (res) => send(res, 200, OPENAPI_SPEC),
  '/api/docs': (res) => sendHtml(res, 200, SWAGGER_UI_HTML),
  '/tree': async (res) => send(res, 200, await buildTree(DOCS_SOURCE_DIR)),
};

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

  if (path === '/health/ready') {
    return handleReady(res);
  }
  if (path === '/content') {
    return handleContent(res, url);
  }

  const staticRoute = STATIC_ROUTES[path];
  if (staticRoute) {
    return staticRoute(res);
  }

  return send(res, 404, { error: 'Not found' });
}

server.listen(PORT, () => {
  process.stdout.write(
    `[docs-api] listening on :${PORT} (source: ${DOCS_SOURCE_DIR})\n`,
  );
});
