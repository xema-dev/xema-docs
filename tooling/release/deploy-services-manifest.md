# `deploy-services-manifest.json`

The build universe this repository ships: every service it produces a deploy
image for. `xema-deploy`'s `check-deploy-service-producers.mjs` reads it to
verify that its reviewed producer contract accounts for **every** artifact this
repo can build — a service present here but absent from the contract fails CI,
so a new image can never quietly become deployable without review.

## Why it is hand-written here, and generated in xema-base

`xema-base` derives its manifest (`generate-deploy-services-manifest.mjs`) by
walking 38 biome manifests; deriving is the only sane option at that size.

This repository ships exactly ONE service, and it is not discoverable by the
same walk: `docs-api` is not a biome, has no `xema-biome.json`, and is not a
workspace package. Its image is the WHOLE REPOSITORY — the root `Dockerfile`
copies `service/` and `content/` onto `node:22-slim` with no build step — which
is why `path` is `.` and `workspace` is `false`.

So there is nothing to derive it from. Writing a generator that reads one
hard-coded service and prints it back would be indirection, not automation.

## Keeping it honest

It is not free-floating: the values are asserted from three directions, so a
drift fails rather than rots.

- `xema-deploy`'s producer check requires `imageRepository` to equal
  `ghcr.io/xema-dev/<service>`, requires the service to be `enabled` in that
  deployment's `services.yaml`, and requires `charts/<service>/Chart.yaml` to
  exist.
- `build-image.yaml` reads THIS file for the service name and image repository
  rather than repeating them, and hashes it into the signed source binding —
  so the manifest, the image that was built, and the deploy payload cannot
  disagree without the deploy gate refusing the dispatch.
- Adding a second service here without adding it to the producer contract fails
  `check-deploy-service-producers.mjs` in xema-deploy.
