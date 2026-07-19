# Streaming and SSE Guide

The **streaming layer** enables low-latency UI updates without aggressive polling. Use SSE where users need live progress, live logs, or cross-tab invalidation.

---

## SSE Endpoints You Should Know

| API | Endpoint | Typical use | Notes |
|---|---|---|---|
| activity-feed-api | GET /realtime/stream | Unified realtime stream for org/project/session updates | In some deployments this route is provided by a shared module and may be absent from generated Swagger |
| activity-feed-api | POST /realtime/streams/:connectionId/subscriptions | Add project/session scoped subscriptions | Scope-specific opt-in after stream connect |
| activity-feed-api | DELETE /realtime/streams/:connectionId/subscriptions/:scopeKind/:scopeId | Remove scope subscriptions | Used when switching project/session context |
| activity-feed-api | GET /realtime/sessions/:sessionId/stream | Dedicated high-frequency session stream | Intended for very high event-rate session surfaces |
| agent-session-api | POST /sessions/:id/threads/:threadId/messages | Stream agent turn output back to client | SSE response on a POST request; every frame carries the `threadId` it belongs to |
| agent-session-api | GET /sessions/:id/preview/apps/:appId/logs | Stream preview app stdout/stderr | Useful for live app diagnostics in session UIs |
| workflow-engine-api | GET /workflows/:slug/runs/:id/stream | Stream workflow run status transitions | Includes snapshot/status/heartbeat/terminal frames |

## Reconnect and Cursor Model

### Last-Event-ID for unified realtime

For unified realtime connections, clients send a JSON cursor map in `Last-Event-ID`.

```http
Last-Event-ID: {"global":"81234","org":"302","project":{"proj_1":"44"},"session":{"sess_1":"9"}}
```

Expected behavior:

- Server replays within the supported replay window.
- If the cursor is too old, server emits a `resync` control event and closes.
- Client should clear stored cursors and reconnect from a fresh baseline.

### Heartbeats and liveness

- Unified realtime sends heartbeat control frames periodically.
- Client watchdog should reconnect if no frame arrives within expected timeout.
- Session/post streams can also emit heartbeat comments to keep intermediaries from closing idle connections.

## Control Frames vs Data Frames

### Control frames

Control frames are sent with SSE `event:` names such as:

- connected
- heartbeat
- subscribed
- unsubscribed
- resync
- scope_denied
- goodbye

### Data frames

Data frames carry event envelope payloads and are typically handled on the default `message` channel. Client behavior should be event-type driven and idempotent.

## Payload Contract: CloudEvents Over SSE

Unified realtime SSE (`GET /realtime/stream`) delivers CloudEvents-style envelopes as the `data:` payload.

- `event:` is usually `message` for data frames.
- `id:` is set from the global sequence value when available.
- `data:` is a JSON envelope containing CloudEvents core fields plus Xema event-hub extension attributes.

For the CloudEvents standard, see: https://cloudevents.io/

### What to expect in each data frame

Common core fields:

- `id`
- `source`
- `specversion`
- `type`
- `subject` (optional)
- `time`

Common Xema extension fields used by realtime delivery and cursoring:

- `ehorgid`
- `ehprojectid` (optional)
- `ehuserid` (optional)
- `ehvisibility` (`internal`, `public`, `project`, `user`)
- `ehglobalseq`
- `ehorgseq`
- `ehprojectseq` (optional)
- `ehsessionseq` (optional)

### Example envelope

```json
{
  "id": "c9d59f6e-76c8-4d5d-a9a2-29d16467d34f",
  "source": "xema/workflow-engine-api",
  "specversion": "1.0",
  "type": "workflow.run.completed",
  "subject": "project/proj_123",
  "time": "2026-04-27T15:41:02.128Z",
  "ehorgid": "org_123",
  "ehprojectid": "proj_123",
  "ehvisibility": "project",
  "ehglobalseq": "918273",
  "ehorgseq": "2210",
  "ehprojectseq": "809",
  "data": {
    "runId": "run_42",
    "workflowSlug": "engineering-standard"
  }
}
```

## Why This Is Documented Here

Swagger usually describes the HTTP route but not the live event envelope matrix in enough detail for stream consumers. Treat this page as the authoritative consumer guide for control-frame behavior, CloudEvents payload shape, and reconnect/cursor semantics.

<!-- AUTO-GENERATED:REALTIME_EVENTS_START -->
## Realtime Events You May Receive

This section is auto-generated from every backend service's event descriptor registry. It is regenerated after adding or modifying a `defineEvent({...})` declaration.

### Domain Summary

| Domain | Event Count |
|---|---:|
| <literal> | 1 |
| Agent | 3 |
| Artifact | 4 |
| Backlog | 12 |
| Biome_host | 4 |
| Deliverable | 1 |
| External | 2 |
| Integration | 4 |
| Kb | 11 |
| Llm | 18 |
| Memory | 7 |
| Migration | 5 |
| Org | 18 |
| Organization | 1 |
| Platform | 1 |
| Project | 13 |
| Search | 6 |
| Session | 31 |
| User Hub | 3 |
| Workflow | 41 |
| Workload | 6 |
| Workspace Git | 1 |
| Xema | 4 |

### Event Types

| Event Type | Domain | Visibility | Producing Service | Description |
|---|---|---|---|---|
| `<literal>` | <literal> | USER | agent-session-api | An Output Surface Inspector command dispatched to the FE relay for execution in the user output surface tab. |
| `agent.definition.created` | Agent | INTERNAL | llm-registry-api | An agent definition was created. |
| `agent.definition.deleted` | Agent | INTERNAL | llm-registry-api | An agent definition was deleted. |
| `agent.definition.updated` | Agent | INTERNAL | llm-registry-api | An agent definition was updated. |
| `artifact.artifact.created` | Artifact | PROJECT | artifact-store-api | A new artifact row was created in the artifact store. |
| `artifact.artifact.linked` | Artifact | PROJECT | artifact-store-api | An artifact was linked to a reference (e.g. a pipeline-run). |
| `artifact.artifact.versioned` | Artifact | PROJECT | artifact-store-api | A new version was appended (or replaced) on an artifact. |
| `artifact.row.changed` | Artifact | PROJECT | artifact-store-api | An artifact was created, updated, or deleted. |
| `backlog.board.ready_changed` | Backlog | PROJECT | backlog-api | A backlog item ready-for-board state changed. |
| `backlog.delivery-phase.created` | Backlog | PROJECT | backlog-api | A delivery phase was created. |
| `backlog.delivery-phase.deleted` | Backlog | PROJECT | backlog-api | A delivery phase was deleted. |
| `backlog.delivery-phase.updated` | Backlog | PROJECT | backlog-api | A delivery phase was updated. |
| `backlog.delivery-phases.confirmed` | Backlog | PROJECT | backlog-api | A set of delivery phases was confirmed for the project. |
| `backlog.delivery-phases.reconciled` | Backlog | PROJECT | backlog-api | Delivery phases were reconciled with the underlying source content. |
| `backlog.item.created` | Backlog | PROJECT | backlog-api | A backlog item was created. |
| `backlog.item.deleted` | Backlog | PROJECT | backlog-api | A backlog item was deleted. |
| `backlog.item.status_changed` | Backlog | PROJECT | backlog-api | A backlog item status changed. |
| `backlog.item.updated` | Backlog | PROJECT | backlog-api | A backlog item was updated. |
| `backlog.sync.pulled` | Backlog | PROJECT | backlog-api | Backlog items were pulled from an external source. |
| `backlog.sync.pushed` | Backlog | PROJECT | backlog-api | Backlog items were pushed to an external destination. |
| `biome_host.installation.bundle_ready` | Biome_host | PROJECT | biome-host-api | Biome bundle fetched + verified + uploaded to S3 — ready to schedule a sidecar/HttpApi workload. |
| `biome_host.installation.state_changed` | Biome_host | PROJECT | biome-host-api | A BiomeInstallation transitioned between lifecycle states (pending_config → active → disabled). |
| `biome_host.org_enablement.changed` | Biome_host | PUBLIC | biome-host-api | An org admin changed the effective enablement state or surfaceMode of a biome for the org. |
| `biome_host.org_enablement.changed` | Biome_host | PUBLIC | public-gateway-api | biome-host-api signalled that an org admin changed biome enablement — gateway invalidates its reachability cache. |
| `deliverable.spec.created` | Deliverable | INTERNAL | deliverable-specs-api | A deliverable spec was created. |
| `external.adapter.configured` | External | PROJECT | connector-gateway-api | A project-level adapter binding was configured or updated. |
| `external.sync.requested` | External | PROJECT | connector-gateway-api | A sync was requested for a project-level adapter binding (manual or webhook-triggered). |
| `connector.connection.removed` | Integration | INTERNAL | connector-gateway-api | An organization-level connector connection was removed. |
| `connector.connection.removed` | Integration | INTERNAL | connector-gateway-api | Connection removed — purge org repositories + project bindings for the integration. |
| `integration.sync.completed` | Integration | PROJECT | connector-gateway-api | A scheduled or manual sync run completed. |
| `integration.sync.failed` | Integration | PROJECT | connector-gateway-api | A scheduled or manual sync run failed. |
| `kb.comment.added` | Kb | PROJECT | knowledge-base-api | A user anchored a new comment on a document page. |
| `kb.comment.resolved` | Kb | PROJECT | knowledge-base-api | A document-page comment was marked RESOLVED. |
| `kb.ingestion.completed` | Kb | PROJECT | knowledge-base-api | A KB ingestion job completed. |
| `kb.page.approved` | Kb | PROJECT | knowledge-base-api | A KB page proposal was approved (transitioned to PUBLISHED). |
| `kb.page.created` | Kb | PROJECT | knowledge-base-api | A KB page was created. |
| `kb.page.deleted` | Kb | PROJECT | knowledge-base-api | A KB page was deleted. |
| `kb.page.status_changed` | Kb | PROJECT | knowledge-base-api | A KB page status changed. |
| `kb.page.updated` | Kb | PROJECT | knowledge-base-api | A KB page was updated. |
| `kb.patch.decided` | Kb | PROJECT | knowledge-base-api | A pending patch was accepted or rejected by the user. |
| `kb.patch.proposed` | Kb | PROJECT | knowledge-base-api | A Document-Buddy agent (or workflow review activity) proposed one  |
| `kb.patch.stale` | Kb | PROJECT | knowledge-base-api | A pending patch was marked STALE because the document moved out  |
| `llm.embedding.commitment.activated` | Llm | PROJECT | llm-registry-api | Per-org embedding commitment flipped proposed → active. |
| `llm.embedding.commitment.created` | Llm | PROJECT | llm-registry-api | Per-org embedding commitment row was created (proposed state). |
| `llm.embedding.commitment.updated_same_dim` | Llm | PROJECT | llm-registry-api | Embedding model swap with matching dimension (no migration). |
| `llm.embedding.migration.completed` | Llm | PROJECT | llm-registry-api | All consumers reported done; commitment advanced to new model. |
| `llm.embedding.migration.failed` | Llm | PROJECT | llm-registry-api | A consumer failed; commitment reverted to previous model. |
| `llm.embedding.migration.progress` | Llm | PROJECT | llm-registry-api | Per-consumer migration progress heartbeat / state transition. |
| `llm.embedding.migration.rolled_back` | Llm | PROJECT | llm-registry-api | Operator rolled back an in-progress migration. |
| `llm.embedding.migration.started` | Llm | PROJECT | llm-registry-api | Dimension-change embedding migration started, or stalled-walker wakeup replay. |
| `llm.model-strategy.bound` | Llm | PROJECT | llm-registry-api | A model strategy was bound to a project. |
| `llm.model-strategy.created` | Llm | PROJECT | llm-registry-api | A model strategy was created or adopted from a system strategy. |
| `llm.model-strategy.deleted` | Llm | PROJECT | llm-registry-api | A model strategy was deleted. |
| `llm.model-strategy.entries.updated` | Llm | PROJECT | llm-registry-api | Strategy entries were replaced. |
| `llm.model-strategy.unbound` | Llm | PROJECT | llm-registry-api | A model strategy binding was removed from a project. |
| `llm.model-strategy.updated` | Llm | PROJECT | llm-registry-api | A model strategy row was updated (excluding entries). |
| `llm.model.synced` | Llm | PROJECT | llm-registry-api | Provider /models endpoint sync completed. |
| `llm.provider.created` | Llm | PROJECT | llm-registry-api | A LLM provider row was created for an org. |
| `llm.provider.deleted` | Llm | PROJECT | llm-registry-api | A LLM provider row was deleted. |
| `llm.provider.updated` | Llm | PROJECT | llm-registry-api | A LLM provider row was updated. |
| `memory.maintenance.partition.processed` | Memory | INTERNAL | memory-api | One  |
| `memory.maintenance.run.completed` | Memory | INTERNAL | memory-api | A memory-maintenance run reached a terminal state (SUCCEEDED or FAILED). |
| `memory.maintenance.run.started` | Memory | INTERNAL | memory-api | A scheduled or volume-triggered memory-maintenance run started for an org. |
| `memory.maintenance.writes_threshold_reached` | Memory | INTERNAL | memory-api | The per-org write counter crossed the maintenance volume threshold; consumers should start an out-of-band maintenance run. |
| `memory.memory.deleted` | Memory | INTERNAL | memory-api | A memory file was deleted. |
| `memory.memory.renamed` | Memory | INTERNAL | memory-api | A memory slug was renamed; the old slug is registered as a soft-redirect alias for 30 days. |
| `memory.memory.written` | Memory | INTERNAL | memory-api | An agent-driven memory write (create or append or str_replace) was applied. |
| `migration.job.completed` | Migration | PROJECT | connector-gateway-api | Migration completed successfully. |
| `migration.job.confirmed` | Migration | PROJECT | connector-gateway-api | A migration plan was confirmed and queued for execution. |
| `migration.job.failed` | Migration | PROJECT | connector-gateway-api | Migration execution failed. |
| `migration.job.started` | Migration | PROJECT | connector-gateway-api | Migration execution started. |
| `migration.plan.created` | Migration | PROJECT | connector-gateway-api | A migration plan was created (pending confirmation). |
| `org.document-template.published` | Org | INTERNAL | artifact-store-api | Org-published document template artifact ready for pre-staging. |
| `org.document-template.published` | Org | INTERNAL | workspace-orchestrator-api | Org-published document template artifact ready for pre-staging. |
| `org.document-template.unpublished` | Org | INTERNAL | artifact-store-api | Org-published document template version withdrawn — triggers refcount GC. |
| `org.document-template.unpublished` | Org | INTERNAL | workspace-orchestrator-api | Org-published document template version withdrawn — triggers refcount GC. |
| `org.document-template.updated` | Org | INTERNAL | artifact-store-api | Org-published document template metadata or layers updated — re-materialize. |
| `org.document-template.updated` | Org | INTERNAL | workspace-orchestrator-api | Org-published document template metadata or layers updated — re-materialize. |
| `org.document-theme.published` | Org | INTERNAL | artifact-store-api | Org-published document theme artifact ready for pre-staging. |
| `org.document-theme.published` | Org | INTERNAL | workspace-orchestrator-api | Org-published document theme artifact ready for pre-staging. |
| `org.document-theme.unpublished` | Org | INTERNAL | artifact-store-api | Org-published document theme version withdrawn — triggers refcount GC. |
| `org.document-theme.unpublished` | Org | INTERNAL | workspace-orchestrator-api | Org-published document theme version withdrawn — triggers refcount GC. |
| `org.document-theme.updated` | Org | INTERNAL | artifact-store-api | Org-published document theme metadata or layers updated — re-materialize. |
| `org.document-theme.updated` | Org | INTERNAL | workspace-orchestrator-api | Org-published document theme metadata or layers updated — re-materialize. |
| `org.scaffold.published` | Org | INTERNAL | artifact-store-api | Org-published scaffold artifact ready for pre-staging into pool template shares. |
| `org.scaffold.published` | Org | INTERNAL | workspace-orchestrator-api | Org-published scaffold artifact ready for pre-staging into pool template shares. |
| `org.scaffold.unpublished` | Org | INTERNAL | artifact-store-api | Org-published scaffold version withdrawn — triggers refcount GC. |
| `org.scaffold.unpublished` | Org | INTERNAL | workspace-orchestrator-api | Org-published scaffold version withdrawn — triggers refcount GC. |
| `org.scaffold.updated` | Org | INTERNAL | artifact-store-api | Org-published scaffold metadata or layers updated — re-materialize. |
| `org.scaffold.updated` | Org | INTERNAL | workspace-orchestrator-api | Org-published scaffold metadata or layers updated — re-materialize. |
| `organization.organization.deleted` | Organization | INTERNAL | connector-gateway-api | Organization deleted — cascade delete all SCM data. |
| `platform.workflow_runtime.namespace.provisioned` | Platform | INTERNAL | workflow-engine-api | The engine provisioned a per-organization Xema Workflow Runtime namespace (RegisterNamespace + retention + search-attrs converged). Workers should add the namespace to their polling fleet. |
| `project.bootstrap.plan.seeded` | Project | PROJECT | project-registry-api | Bootstrap plan was seeded for the project. |
| `project.bootstrap.requested` | Project | PROJECT | project-registry-api | Bootstrap was requested for the project. |
| `project.integration.updated` | Project | PROJECT | project-registry-api | A project integration was updated. |
| `project.manifest.updated` | Project | PROJECT | project-registry-api | The project manifest was updated. |
| `project.project.created` | Project | PROJECT | connector-gateway-api | Project created — auto-provision Gitea repository. |
| `project.project.created` | Project | PROJECT | project-registry-api | A project was created. |
| `project.project.deleted` | Project | PROJECT | connector-gateway-api | Project deleted — cascade delete repositories. |
| `project.project.deleted` | Project | PROJECT | project-registry-api | A project was deleted. Canonical signal for cascade cleanup across the platform. |
| `project.project.updated` | Project | PROJECT | project-registry-api | Editable project metadata was updated. |
| `project.repo.linked` | Project | PROJECT | project-registry-api | A repository was linked to the project. |
| `project.role.granted` | Project | PROJECT | project-registry-api | A project role was granted to a user. |
| `project.role.revoked` | Project | PROJECT | project-registry-api | A project role was revoked from a user. |
| `project.settings.updated` | Project | PROJECT | project-registry-api | Project settings were updated. |
| `search.deadletter.created` | Search | PROJECT | search-api | A search-related event could not be processed and was moved to deadletter. |
| `search.document.deleted` | Search | PROJECT | search-api | Search documents were deleted. |
| `search.document.indexed` | Search | PROJECT | search-api | Search documents were indexed. |
| `search.reindex.completed` | Search | INTERNAL | search-api | Search reindexing job completed successfully. |
| `search.reindex.failed` | Search | INTERNAL | search-api | Search reindexing job failed. |
| `search.reindex.started` | Search | INTERNAL | search-api | Search reindexing job started. |
| `session.command.executed` | Session | USER | agent-session-api | Xema Agent Runtime executed a slash-command inside the session (e.g. /compact, /share). Audit + UI feedback. |
| `session.diff.changed` | Session | USER | agent-session-api | Xema Agent Runtime reported a workspace diff change. Frontend uses this to refresh the diff panel without polling. |
| `session.file.edited` | Session | USER | agent-session-api | A file in the agent workspace was edited. |
| `session.git_status.changed` | Session | PROJECT | agent-session-api | Session workspace git state flipped (branch / push / PR). |
| `session.git.conflict-dispatch-acknowledged` | Session | PROJECT | agent-session-api | agent-session-api received  |
| `session.history.compacted` | Session | USER | agent-session-api | Xema Agent Runtime compacted the session history (older messages summarized into a compaction part). FE should refresh its message list cursor. |
| `session.idle.changed` | Session | USER | agent-session-api | Session went idle / active. Drives typing indicators. |
| `session.lifecycle.changed` | Session | PROJECT | agent-session-api | Coarse session-row change ping (created/terminated/etc). |
| `session.message.part.removed` | Session | USER | agent-session-api | A previously streamed message part was removed (e.g. retry). |
| `session.message.part.updated` | Session | USER | agent-session-api | Streaming chunk of an LLM message part. |
| `session.message.removed` | Session | USER | agent-session-api | A message was removed from the session (e.g. user undo). |
| `session.message.updated` | Session | USER | agent-session-api | A message frame was finalised (full assembly after streaming) or otherwise replaced. |
| `session.output-surface.changed` | Session | PROJECT | agent-session-api | Session output surface app status changed. |
| `session.permission.replied` | Session | USER | agent-session-api | A permission request was answered. Distinct from  |
| `session.permission.requested` | Session | USER | agent-session-api | Xema Agent Runtime asked the user for permission to perform an action. |
| `session.permission.resolved` | Session | USER | agent-session-api | A permission request was resolved by the user. |
| `session.provisioning.changed` | Session | PROJECT | agent-session-api | Session provisioning phase transitioned. |
| `session.runtime.connected` | Session | USER | agent-session-api | Xema Agent Runtime HTTP server announced itself on the SSE stream. Useful as a heartbeat / reconnect signal in the UI. |
| `session.runtime.created` | Session | USER | agent-session-api | Xema Agent Runtime runtime created a new session row (the runtime-side counterpart to our DB session). Used to detect cold-start session lifecycle. |
| `session.runtime.deleted` | Session | USER | agent-session-api | Session was deleted from the Xema Agent Runtime runtime. |
| `session.runtime.errored` | Session | USER | agent-session-api | A session-scoped error surfaced from Xema Agent Runtime. |
| `session.runtime.installation_updated` | Session | USER | agent-session-api | Xema Agent Runtime runtime detected an installation/upgrade change. UIs may want to surface a  |
| `session.runtime.ratelimited` | Session | USER | agent-session-api | Session hit a model / provider rate limit. |
| `session.runtime.status_changed` | Session | USER | agent-session-api | Xema Agent Runtime runtime reported a status transition for the session (idle / busy / retrying). Drives typing indicators and retry banners. |
| `session.runtime.updated` | Session | USER | agent-session-api | Session metadata changed in the Xema Agent Runtime runtime (title, share state, etc.). |
| `session.tasks.changed` | Session | USER | agent-session-api | Xema Agent Runtime todo list for the session changed. FE refreshes the task panel. |
| `session.terminal.changed` | Session | USER | agent-session-api | A terminal (pty) attached to the session was created, updated, exited or deleted. Single descriptor; consumers discriminate on  |
| `session.tool.call.completed` | Session | USER | agent-session-api | A tool invocation finished successfully. |
| `session.tool.call.failed` | Session | USER | agent-session-api | A tool invocation failed. |
| `session.tool.call.started` | Session | USER | agent-session-api | A tool invocation is about to run. |
| `session.tools.changed` | Session | PROJECT | agent-session-api | Session tool catalog (MCP / skill) changed. |
| `user-hub.notification.created` | User Hub | USER | user-hub-api | A notification was created for a single target user. |
| `user-hub.notification.status_changed` | User Hub | USER | user-hub-api | A notification transitioned between lifecycle states. |
| `user-hub.notification.user_state_changed` | User Hub | USER | user-hub-api | A user-initiated notification state change (read / dismiss). |
| `workflow.activity.attempt_failed` | Workflow | PROJECT | Xema workflow worker service | A Xema runtime activity attempt failed and is being retried (bridge: synthesized from describeWorkflowExecution.pendingActivities). |
| `workflow.activity.cancel_requested` | Workflow | PROJECT | Xema workflow worker service | Cancellation requested for a Xema runtime activity task. |
| `workflow.activity.completed` | Workflow | PROJECT | Xema workflow worker service | A Xema runtime activity task completed (bridge: ActivityTaskCompleted). |
| `workflow.activity.deliverable.self-correction-failed` | Workflow | PROJECT | Xema workflow worker service | Re-harvest after the self-correction message still failed validation. The activity throws DELIVERABLE_CONTRACT_VIOLATED (non-retryable) and the workflow terminates cleanly. |
| `workflow.activity.deliverable.self-correction-started` | Workflow | PROJECT | Xema workflow worker service | Agent activity sent the structured correction follow-up message into the same Xema Agent Runtime session (turnId reused). Frontend shows  |
| `workflow.activity.deliverable.self-correction-succeeded` | Workflow | PROJECT | Xema workflow worker service | Re-harvest after the self-correction message produced a deliverable that satisfies the spec contract. The activity returns the canonical envelope with  |
| `workflow.activity.deliverable.validation-failed` | Workflow | PROJECT | Xema workflow worker service | Agent activity harvested its workspace and the deliverable spec output contract failed. Carries  |
| `workflow.activity.failed` | Workflow | PROJECT | Xema workflow worker service | A Xema runtime activity task failed (bridge: ActivityTaskFailed). |
| `workflow.activity.heartbeat` | Workflow | PROJECT | Xema workflow worker service | A worker activity reported in-progress mid-execution. |
| `workflow.activity.scheduled` | Workflow | PROJECT | Xema workflow worker service | A Xema runtime activity task was scheduled (bridge: ActivityTaskScheduled). |
| `workflow.activity.started` | Workflow | PROJECT | Xema workflow worker service | A Xema runtime activity task started (bridge: ActivityTaskStarted). |
| `workflow.activity.step` | Workflow | PROJECT | Xema workflow worker service | Activity-internal step progress (THINKING / EDITING_FILE / RUNNING_COMMAND / ...). Replaces the legacy in-memory RunProgressFanoutService path. |
| `workflow.activity.timed_out` | Workflow | PROJECT | Xema workflow worker service | A Xema runtime activity task timed out (bridge: ActivityTaskTimedOut). |
| `workflow.child.canceled` | Workflow | PROJECT | Xema workflow worker service | A child workflow execution was canceled (bridge: ChildWorkflowExecutionCanceled). |
| `workflow.child.completed` | Workflow | PROJECT | Xema workflow worker service | A child workflow execution completed (bridge: ChildWorkflowExecutionCompleted). |
| `workflow.child.failed` | Workflow | PROJECT | Xema workflow worker service | A child workflow execution failed (bridge: ChildWorkflowExecutionFailed). |
| `workflow.child.started` | Workflow | PROJECT | Xema workflow worker service | A child workflow execution started (bridge: ChildWorkflowExecutionStarted). |
| `workflow.child.timed_out` | Workflow | PROJECT | Xema workflow worker service | A child workflow execution timed out (bridge: ChildWorkflowExecutionTimedOut). |
| `workflow.inquiry.cancelled` | Workflow | PROJECT | workflow-engine-api | A pending inquiry was cancelled (parent run cancelled, or explicit cancel). |
| `workflow.inquiry.created` | Workflow | PROJECT | workflow-engine-api | An inquiry was created and is awaiting recipient replies (decision gate or agent tool inquiry). |
| `workflow.inquiry.escalated` | Workflow | PROJECT | workflow-engine-api | An inquiry advanced to the next escalation level: previous recipients skipped, new recipients added, deadline reset. |
| `workflow.inquiry.reply` | Workflow | PROJECT | workflow-engine-api | A recipient submitted a reply on an inquiry. |
| `workflow.inquiry.resolved` | Workflow | PROJECT | workflow-engine-api | An inquiry reached a terminal verdict (recipient policy satisfied, or expired). |
| `workflow.job.changed` | Workflow | PROJECT | workflow-engine-api | A job within a run changed status. |
| `workflow.marker.recorded` | Workflow | PROJECT | Xema workflow worker service | A Xema runtime marker was recorded (bridge: MarkerRecorded — sideEffect, upsertSearchAttributes, etc.). |
| `workflow.run.canceled` | Workflow | PROJECT | Xema workflow worker service | Workflow run was canceled (bridge: WorkflowExecutionCanceled). |
| `workflow.run.completed` | Workflow | PROJECT | workflow-engine-api | A run completed successfully. |
| `workflow.run.continued_as_new` | Workflow | PROJECT | Xema workflow worker service | Workflow run continued-as-new (bridge: WorkflowExecutionContinuedAsNew). |
| `workflow.run.created` | Workflow | PROJECT | workflow-engine-api | A new pipeline run was dispatched. |
| `workflow.run.failed` | Workflow | PROJECT | workflow-engine-api | A run failed. |
| `workflow.run.milestone` | Workflow | PROJECT | workflow-engine-api | A coarse milestone within a run — activity start/complete/awaiting-input — emitted by the runtime worker through the engine. |
| `workflow.run.started` | Workflow | PROJECT | workflow-engine-api | A pipeline run started executing on the Xema workflow worker service (mapped from WorkflowExecutionStarted history event). |
| `workflow.run.status_changed` | Workflow | PROJECT | workflow-engine-api | A run transitioned between status states. |
| `workflow.run.timed_out` | Workflow | PROJECT | Xema workflow worker service | Workflow run timed out (bridge: WorkflowExecutionTimedOut). |
| `workflow.signal.received` | Workflow | PROJECT | Xema workflow worker service | Workflow received a signal (bridge: WorkflowExecutionSignaled). |
| `workflow.timer.canceled` | Workflow | PROJECT | Xema workflow worker service | A Xema runtime timer was canceled (bridge: TimerCanceled). |
| `workflow.timer.fired` | Workflow | PROJECT | Xema workflow worker service | A Xema runtime timer fired (bridge: TimerFired). |
| `workflow.timer.started` | Workflow | PROJECT | Xema workflow worker service | A Xema runtime timer was started (bridge: TimerStarted). |
| `workflow.update.accepted` | Workflow | PROJECT | Xema workflow worker service | A workflow update was accepted (bridge: WorkflowExecutionUpdateAccepted). |
| `workflow.update.completed` | Workflow | PROJECT | Xema workflow worker service | A workflow update completed (bridge: WorkflowExecutionUpdateCompleted). |
| `workflow.update.rejected` | Workflow | PROJECT | Xema workflow worker service | A workflow update was rejected (bridge: WorkflowExecutionUpdateRejected). |
| `workload.lifecycle.degraded` | Workload | INTERNAL | workload-runtime-api | Workload partial outage detected (replicas below minimum). |
| `workload.lifecycle.deleted` | Workload | INTERNAL | workload-runtime-api | Workload deleted. Terminal. |
| `workload.lifecycle.draining` | Workload | INTERNAL | workload-runtime-api | Workload entering drain phase before deletion. |
| `workload.lifecycle.failed` | Workload | INTERNAL | workload-runtime-api | Workload failed terminally — retries exhausted or fatal error. |
| `workload.lifecycle.ready` | Workload | INTERNAL | workload-runtime-api | Workload is healthy and discoverable. Carries endpoint or connection info. |
| `workload.lifecycle.scheduled` | Workload | INTERNAL | workload-runtime-api | Workload accepted by the scheduler — backend objects are being created. |
| `workspace-git.conflict.dispatch-requested` | Workspace Git | PROJECT | workspace-git-api | A publish-to-production attempt hit a remote-fast-forward conflict;  |
| `xema.biome.installation.lifecycle.changed.v1` | Xema | PROJECT | biome-host-api | A BiomeInstallation traversed a capability-gated lifecycle transition. |
| `xema.composition.published.v1` | Xema | PROJECT | llm-registry-api | A draft Agent Composition was published as a new immutable version.  |
| `xema.kernel.released` | Xema | INTERNAL | workspace-orchestrator-api | Kernel image released — triggers an immediate SyncSystemTemplates run. |
| `xema.store.install.created.v1` | Xema | PROJECT | xema-store-api | A new StoreInstall row was committed. biome-host-api consumes this to materialize the install runtime. |
<!-- AUTO-GENERATED:REALTIME_EVENTS_END -->

## Client Integration Pattern

```ts
const source = new EventSource('/realtime/stream', {
  // Use a fetch-based polyfill when you need Authorization + Last-Event-ID headers.
});

source.addEventListener('connected', (e) => {
  const frame = JSON.parse((e as MessageEvent).data);
  console.log('connected', frame.connectionId);
});

source.addEventListener('resync', () => {
  // Drop local cursor state and force a full refetch strategy.
  resetLocalRealtimeCursors();
  source.close();
  reconnectFromZero();
});

source.onmessage = (e) => {
  const envelope = JSON.parse(e.data);
  applyInvalidation(envelope.type, envelope);
};
```

## When to Use SSE vs Polling

Use SSE when:

- users watch long-running workflow/session operations,
- multiple browser tabs need near-realtime coherence,
- log streams or token streams must feel continuous.

Use polling when:

- data changes slowly,
- eventual consistency is acceptable,
- infrastructure constraints do not justify persistent connections.

---

**Previous**: [← API Selection Guide](./02-api-selection-guide.md)
**Next**: [Activity Feed Realtime Frames →](./04-activity-feed-realtime-frames.md)
