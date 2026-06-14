# syntax=docker/dockerfile:1
# =============================================================================
# docs-api image — the public documentation content server.
#
# This repo (xema-docs) is the single source of truth for Xema public docs.
# The image bakes the `content/` markdown bundle and the zero-dependency Node
# server, so the service builds and runs entirely on its own.
#
#   docker build -t ghcr.io/xema-dev/docs-api:dev .
#
# Deployed to the cluster via xema-deploy (charts/docs-api). The host-web docs
# viewer (xema.dev/docs) and xema-shell-api both consume it.
# =============================================================================

FROM public.ecr.aws/docker/library/node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DOCS_SOURCE_DIR=/app/content

# BUILD_SHA changes per commit so the content COPY layer cache busts on every
# docs edit (CI passes it).
ARG BUILD_SHA=unknown

# Zero npm dependencies — copy the server and the content bundle as-is.
COPY service/ ./service/
COPY content/ ./content/

USER node

EXPOSE 3000

CMD ["node", "service/server.mjs"]
