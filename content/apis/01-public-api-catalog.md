# Public API Catalog

The **catalog** below lists all publicly reachable Xema APIs and their primary integration role. Use it as a map before you start endpoint-level implementation.

---

## Public APIs

| API | Use it for | What to expect | Swagger |
|---|---|---|---|
| activity-feed-api | Unified activity timelines and realtime event fan-out | Cross-project inbox, project feeds, unread cursors, and realtime stream delivery | https://activity-feed-api.xema.dev/api/docs |
| artifact-store-api | Persisting and retrieving workflow/session artifacts | Durable artifact metadata and content retrieval patterns | https://artifact-store-api.xema.dev/api/docs |
| audit-log-api | Compliance and traceability records | Immutable operational audit history for critical actions | https://audit-log-api.xema.dev/api/docs |
| backlog-api | Product and delivery planning entities | Backlog items and delivery-phase state management | https://backlog-api.xema.dev/api/docs |
| biome-host-api | Platform biome discovery and metadata | Biome catalog and host-level biome lifecycle visibility | https://biome-host-api.xema.dev/api/docs |
| brainstorming-api | Structured ideation flows | Brainstorm session lifecycle and generated outcomes | https://brainstorming-api.xema.dev/api/docs |
| catalog-api | Shared catalog discovery | Catalog entities for platform/runtime consumption | https://catalog-api.xema.dev/api/docs |
| deliverable-specs-api | Deliverable templates and contracts | Structured deliverable specifications and lifecycle operations | https://deliverable-specs-api.xema.dev/api/docs |
| docs-api | Public documentation delivery and navigation data | Docs content resolution, section trees, and rendering inputs | https://docs-api.xema.dev/api/docs |
| document-render-api | Rendering documents to portable formats | PDF and DOCX rendering for knowledge-base pages and inline HTML, with downloadable output | https://document-render-api.xema.dev/api/docs |
| governance-api | Human and policy governance workflows | Decisions, interactions, judging, resolution, and presets | https://governance-api.xema.dev/api/docs |
| connector-gateway-api | External provider ingress and adapter orchestration | Provider bindings, sync settings, external webhook edge handling | https://connector-gateway-api.xema.dev/api/docs |
| agent-session-api | Interactive agent-session lifecycle | Session management, chat streaming, preview control, attachment workflows | https://agent-session-api.xema.dev/api/docs |
| knowledge-base-api | Knowledge spaces, pages, ingestion, and graph ops | Space/page lifecycle, ingestion jobs, knowledge graph capabilities | https://knowledge-base-api.xema.dev/api/docs |
| llm-registry-api | LLM, skill, and execution policy governance | Model strategy, capability registry, profiles, and runtime policy controls | https://llm-registry-api.xema.dev/api/docs |
| mcp-gateway-api | MCP server/catalog access gateway | MCP discovery, server metadata, and bridge endpoints | https://mcp-gateway-api.xema.dev/api/docs |
| memory-api | Memory extraction, retrieval, and graph exploration | Memory records, extraction pipelines, and memory graph traversal | https://memory-api.xema.dev/api/docs |
| project-registry-api | Project system-of-record operations | Project registration, variables, manifests, and bindings | https://project-registry-api.xema.dev/api/docs |
| scm-connector-api | Source control integration domain APIs | Repository metadata, change requests, snapshots, and SCM configuration | https://scm-connector-api.xema.dev/api/docs |
| search-api | Search and index management | Search query capabilities plus indexing/admin controls | https://search-api.xema.dev/api/docs |
| user-hub-api | End-user settings and notifications | Preferences, notification streams, and device-oriented settings | https://user-hub-api.xema.dev/api/docs |
| workflow-engine-api | Workflow definition and execution control plane | Workflow CRUD, triggers, run orchestration, approvals, scheduling, run streams | https://workflow-engine-api.xema.dev/api/docs |

---

## Scope Notes

- This catalog includes only APIs with public xema.dev ingress.
- Internal services and private domains are intentionally excluded from public documentation.
- Use the next page to pick the minimal API set for your scenario.

---

**Next**: [API Selection Guide →](./02-api-selection-guide.md)
