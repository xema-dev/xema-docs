# syntax=docker/dockerfile:1
# =============================================================================
# docs-api image — the public documentation content server.
#
# The image bakes the `content/` markdown bundle and the zero-dependency Node
# server, so the service builds and runs entirely on its own. It backs the
# in-app docs viewer at xema.dev/docs.
#
#   docker build -t docs-api:dev .
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
