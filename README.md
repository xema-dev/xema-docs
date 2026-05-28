# xema-docs

Public documentation for the Xema OS platform. Apache-2.0 licensed.

## Layout

- `content/` — the actual documentation tree (Markdown).
  Top-level sections: `xema-os/`, `workflows/`, `workspaces/`,
  `workspace-manifests/`, `biomes/`, `interactive-sessions/`, `dsl/`,
  `deliverables/`, `databases/`, `apis/`, `notifications/`, `templates/`,
  `use-cases/`.
- `astro.config.mjs` + `src/pages/` + `package.json` — minimal Astro
  scaffold. Carved from the monorepo in §K.3 slice 8 of the
  xema-os-plan v4.3. Full Astro content-collection wiring lands per
  the public-docs sweep follow-up.
- `.github/workflows/deploy-pages.yaml` — GitHub Pages deploy on push
  to `main`.

## Local development

```bash
npm install
npm run dev
```

## Contributing

See `CONTRIBUTING.md`.
