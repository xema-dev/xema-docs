# xema-docs

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

The source of truth for the public [Xema](https://xema.dev) documentation. This
repo owns the docs content *and* a small service that serves it:

- **`content/`** — every public doc, as plain Markdown. This is the one place
  public docs are authored.
- **`service/`** — `docs-api`, a zero-dependency Node server that reads
  `content/` and serves it as JSON for the in-app docs viewer at
  [xema.dev/docs](https://xema.dev/docs).
- **`src/`** — a minimal [Astro](https://astro.build) landing page published to
  GitHub Pages at
  [xema-dev.github.io/xema-docs](https://xema-dev.github.io/xema-docs/).

## Authoring content

Pages live under `content/`. Drop a `.md` file in the right folder and it
appears automatically — the tree is derived from the directory layout:

- A folder becomes a collapsible section; its `index.md` is the section landing
  page (labelled "Overview").
- A file's slug is its path under `content/` without the `.md` extension
  (e.g. `content/databases/01-concepts.md` → `databases/01-concepts`), served at
  `xema.dev/docs/databases/01-concepts`.
- A `NN-` numeric prefix only controls ordering; it is stripped from the display
  label.
- `README.md` files are treated as authoring meta and are **not** published.

Some docs carry YAML frontmatter (e.g. `content/xema-os/concepts/*.md` require
`slug`, `title`, `summary`, `stability`) because downstream consumers parse it.
Keep that frontmatter valid.

## Running docs-api locally

The `docs-api` server reads `content/` and serves it as JSON. It has **no npm
dependencies** — Node built-ins only.

```bash
node service/server.mjs        # serves on :3000, reads ./content
```

Endpoints (all public, read-only):

| Route | Returns |
| --- | --- |
| `GET /api/docs` | Swagger UI |
| `GET /api/openapi.json` | OpenAPI 3 spec |
| `GET /tree` | the full doc tree (`DocTreeNode[]`) |
| `GET /content?path=<slug>` | `{ content, path, frontmatter }` — `content` is the display body with any YAML frontmatter stripped; `frontmatter` is the raw frontmatter text (empty when none) for metadata consumers |
| `GET /health/live` / `GET /health/ready` | liveness/readiness probes |

Configuration: `PORT` (default `3000`), `DOCS_SOURCE_DIR` (default `../content`).

## Building the landing page

```bash
npm install && npm run dev      # http://localhost:4321
npm run build                   # -> dist/
```

## Contributing

Contributions land via pull request. All commits must be signed off under the
[Developer Certificate of Origin](https://developercertificate.org/) (DCO) —
add a `Signed-off-by` line with `git commit -s`. Please open an issue before
starting substantial work so we can align on scope, and follow the
[Code of Conduct](./CODE_OF_CONDUCT.md). See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Licensed under the [Apache License, Version 2.0](./LICENSE).
