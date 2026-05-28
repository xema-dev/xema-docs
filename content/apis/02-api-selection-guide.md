# API Selection Guide

The **selection strategy** should start with product outcomes, not endpoint count. Most teams should integrate a small core set first, then add specialized APIs only when needed.

---

## Start With a Minimal Core

For most platform integrations, start with:

- project-registry-api: project context and configuration anchor.
- workflow-engine-api: workflow lifecycle and execution operations.
- activity-feed-api: user-facing activity and realtime notifications.

This gives you configuration, orchestration, and observability without over-coupling to every domain service.

## Add APIs by Capability

| Capability you need | Recommended API set |
|---|---|
| Repository-driven automation | scm-integration-api, integration-adapters-api, workflow-engine-api |
| Backlog to delivery workflow | backlog-api, workflow-engine-api, activity-feed-api |
| Knowledge-assisted workflows | knowledge-base-api, memory-api, search-api |
| Biome-powered extensibility | biome-host-api, catalog-api, llm-registry-api |
| Governance and approvals | governance-api, workflow-engine-api, audit-log-api |
| User personalization and notifications | user-hub-api, activity-feed-api |
| Artifact-first pipelines | artifact-store-api, deliverable-specs-api, workflow-engine-api |
| MCP ecosystem integration | mcp-gateway-api, llm-registry-api |

## What Developers Should Expect

### API behavior model

- APIs are capability-scoped, not monolithic.
- Domain APIs focus on deterministic state transitions for their own aggregates.
- Realtime UX is delivered through streaming channels, not constant polling.

### Integration posture

- Keep orchestration in your application boundary, not in ad-hoc chained API calls.
- Prefer idempotent client behavior for retried writes and reconnect scenarios.
- Treat Swagger as the transport contract and this guide as capability guidance.

### Versioning expectations

- Expect additive evolution in most public contracts.
- Treat business behavior as explicit and typed; avoid assumptions based on side effects.
- Re-validate integration tests whenever new workflow/governance/search features are adopted.

---

## Suggested Adoption Phases

1. Phase 1: Integrate project-registry-api, workflow-engine-api, activity-feed-api.
2. Phase 2: Add domain APIs for your primary product workflow.
3. Phase 3: Add realtime stream handling and targeted invalidation.
4. Phase 4: Add specialized APIs (MCP, biome, memory, governance) as product depth grows.

---

**Previous**: [← Public API Catalog](./01-public-api-catalog.md)
**Next**: [Streaming and SSE Guide →](./03-streaming-and-sse-guide.md)
