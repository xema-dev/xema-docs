# APIs

> API Docs: https://docs-api.xema.dev/api/docs

The **API surface** in Xema is split by capability so teams can integrate only what they need. This section explains what each public API is for, when to use it, and what behavior to expect in production.

## Quick Links

| Page | What it covers |
|---|---|
| [01 Public API Catalog](./01-public-api-catalog.md) | Every public API, its purpose, and its Swagger URL |
| [02 API Selection Guide](./02-api-selection-guide.md) | How to choose the right API per integration scenario |
| [03 Streaming and SSE Guide](./03-streaming-and-sse-guide.md) | Realtime endpoints, reconnect model, and SSE contracts |
| [04 Activity Feed Realtime Frames](./04-activity-feed-realtime-frames.md) | Deep integration guide for realtime frames with examples |

## Getting Started

Recommended order for new integrations:

1. **[Public API Catalog](./01-public-api-catalog.md)** — identify the APIs you actually need.
2. **[API Selection Guide](./02-api-selection-guide.md)** — map your use case to a minimal integration footprint.
3. **[Streaming and SSE Guide](./03-streaming-and-sse-guide.md)** — add realtime behavior only where it adds product value.
4. **[Activity Feed Realtime Frames](./04-activity-feed-realtime-frames.md)** — implement resilient stream consumers with concrete patterns.

## FAQ

**Q: Does this section list internal/private services?**
A: No. It documents only APIs with public ingress on the xema.dev domain.

**Q: Does this replace Swagger?**
A: No. Swagger is the endpoint contract. This section is the capability and adoption guide.
