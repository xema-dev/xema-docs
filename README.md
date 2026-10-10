# xema-docs

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

The source of the public [Xema](https://xema.dev) documentation: the content
and the small service that serves it.

- **`content/`** — every public doc, as plain Markdown. This is the one place
  public docs are authored.
- **`service/`** — `docs-api`, a zero-dependency Node server that reads
  `content/` and serves it as JSON for the in-app docs viewer at
  [xema.dev/docs](https://xema.dev/docs).
- **`src/`** — a minimal [Astro](https://astro.build) landing page published to
  GitHub Pages at
  [xema-dev.github.io/xema-docs](https://xema-dev.github.io/xema-docs/).

## Authoring content

Add a `.md` file under `content/`; the doc tree is derived from the directory layout.

- A folder is a section; its `index.md` is the section landing page.
- A file's slug is its path under `content/` without `.md`
  (`content/databases/01-concepts.md` is served at `xema.dev/docs/databases/01-concepts`).
- A `NN-` prefix only sets ordering and is stripped from the label.
- `README.md` files are authoring notes and are not published.
- Pages under `content/xema-os/concepts/` require YAML frontmatter (`slug`, `title`, `summary`, `stability`); `npm run check:concept-frontmatter` validates it.

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

Pull requests are welcome; sign off commits (`git commit -s`, DCO). See
[CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

Licensed under the [Apache License, Version 2.0](./LICENSE).
