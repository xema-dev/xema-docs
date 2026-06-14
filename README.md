# xema-docs

**The single source of truth for Xema public documentation.** This repo owns
the docs content *and* the service that serves it:

- **`content/`** — every public doc, as plain Markdown. This is the one place
  public docs are authored. There is no other copy.
- **`service/`** — `docs-api`, a zero-dependency Node server that reads
  `content/` and serves it as JSON. It backs the in-app docs viewer at
  **`xema.dev/docs`** (host-web) and is consumed by `xema-shell-api`
  (concept registry).
- **`src/`** — a minimal Astro landing page published to GitHub Pages at
  [xema-dev.github.io/xema-docs](https://xema-dev.github.io/xema-docs/).

## Content

Pages live under `content/`. Drop a `.md` file in the right folder and it
appears automatically — the tree is derived from the directory layout:

- A folder becomes a collapsible section; its `index.md` is the section
  landing page (labelled "Overview").
- A file's slug is its path under `content/` without the `.md` extension
  (e.g. `content/databases/01-concepts.md` → `databases/01-concepts`), served
  at `xema.dev/docs/databases/01-concepts`.
- A `NN-` numeric prefix only controls ordering; it is stripped from the
  display label.
- `README.md` files are treated as authoring meta and are **not** published.

Some docs carry YAML frontmatter (e.g. `content/xema-os/concepts/*.md` require
`slug`, `title`, `summary`, `stability`) because downstream services parse it.
Keep that frontmatter valid — `xema-shell-api` fails fast on a malformed
concept.

## docs-api (`service/`)

Run it locally against `content/`:

```bash
node service/server.mjs        # serves on :3000, reads ./content
```

Endpoints (all public, read-only):

| Route | Returns |
| --- | --- |
| `GET /api/docs/tree` | the full doc tree (`DocTreeNode[]`) |
| `GET /api/docs/content?path=<slug>` | `{ content, path }` (raw Markdown) |
| `GET /health/live` / `GET /health/ready` | k8s probes |

It has **no npm dependencies** — Node built-ins only. Configuration:
`PORT` (default `3000`), `DOCS_SOURCE_DIR` (default `../content`).

### Build & deploy

`docs-api` ships as a container image (`Dockerfile` bakes `content/` +
`service/`). On every push to `main`, `.github/workflows/build-and-dispatch.yaml`
builds `ghcr.io/xema-dev/docs-api:<sha>` and fires a `deploy-service`
dispatch to `xema-dev/xema-deploy`, which runs the Helm upgrade
(`charts/docs-api`, namespace `xema-prod`, host `docs-api.xema.dev`). All
cluster deploys route through xema-deploy.

## Astro landing page

```bash
npm install && npm run dev      # http://localhost:4321
npm run build                   # -> dist/, deployed to GitHub Pages
```

Published by the `deploy-pages` workflow on every push to `main`.

## License

Apache-2.0

## Status

Beta.
