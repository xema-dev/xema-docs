# Activity Feed Realtime Frames

The **realtime frame contract** in activity-feed-api is designed for fast UI invalidation and scoped updates, not full state replication. Integrate it as an event signal layer and refetch authoritative data from domain APIs.

---

## Conceptual Model

activity-feed-api does two things at once:

1. It materializes selected high-value events into persisted feed items.
2. It fans out realtime frames for a broader set of events over SSE.

Important: many realtime frames are intentionally invalidation-only and do not create feed rows.

## Envelope Format You Receive

Activity-feed realtime data frames are CloudEvents-style envelopes delivered over SSE.

- The SSE frame `data:` body is a JSON event envelope.
- The `type` field is the primary event discriminator you should switch on.
- Delivery authorization is evaluated from envelope fields such as `ehorgid`, `ehprojectid`, `ehuserid`, and `ehvisibility`.

For the CloudEvents standard, see: https://cloudevents.io/

### Event shape assumptions for client code

You can safely assume:

- `type` is always present on data frames.
- `ehorgid` and `ehvisibility` are present on deliverable realtime envelopes.
- sequence fields (`ehglobalseq`, `ehorgseq`, optional project/session variants) are used for cursor advancement and replay.

You should not assume:

- every event includes every optional field (`subject`, `ehprojectid`, `ehuserid`),
- every event is relevant to the current page context,
- event `data` payload shape is stable across all event domains unless your integration is pinned to a specific event contract.

## What You Can Expect

### Guaranteed integration expectations

- Org-scoped realtime access with authenticated caller identity.
- Optional project/session subscriptions for narrowed delivery.
- Heartbeat and reconnect-friendly control frames.
- A replay strategy based on `Last-Event-ID` cursor state.

### Feed persistence expectations

High-value event types are persisted into feed history, including examples like:

- workflow run created/completed/failed,
- workflow approval pending/resolved,
- repository snapshot changed,
- governance approval changed,
- knowledge page created/deleted,
- artifact changed.

These appear in feed endpoints such as inbox/project timelines and support unread cursor flows.

### Realtime-only events

Some event types are broadcast for invalidation but intentionally do not materialize into feed rows. Use the matrix below (`Materialized Into Feed Item`) to know which events affect timeline history versus realtime cache invalidation only.

## What You Should Not Expect

- Full domain payloads for every frame.
- Strictly ordered, exactly-once business processing semantics in the browser.
- Realtime frames as a replacement for querying domain APIs.
- Every frame becoming a persisted feed item.

Treat realtime as a low-latency hint channel and make consumers idempotent.

<!-- AUTO-GENERATED:REALTIME_EVENTS_START -->
## Activity Feed Realtime Event Matrix

Every event a subscriber may receive over the unified realtime stream. Materialization into `FeedItem` rows is determined per-descriptor by the `descriptor.feed` metadata block (or a fallback type-keyed map in `activity-feed-api`).

| Event Type | Visibility | Producing Service | Description |
|---|---|---|---|
| `<literal>` | USER | agent-session-api | An Output Surface Inspector command dispatched to the FE relay for execution in the user output surface tab. |
| `agent.definition.created` | INTERNAL | llm-registry-api | An agent definition was created. |
| `agent.definition.deleted` | INTERNAL | llm-registry-api | An agent definition was deleted. |
| `agent.definition.updated` | INTERNAL | llm-registry-api | An agent definition was updated. |
| `artifact.artifact.created` | PROJECT | artifact-store-api | A new artifact row was created in the artifact store. |
| `artifact.artifact.linked` | PROJECT | artifact-store-api | An artifact was linked to a reference (e.g. a pipeline-run). |
| `artifact.artifact.versioned` | PROJECT | artifact-store-api | A new version was appended (or replaced) on an artifact. |
| `artifact.row.changed` | PROJECT | artifact-store-api | An artifact was created, updated, or deleted. |
| `backlog.board.ready_changed` | PROJECT | backlog-api | A backlog item ready-for-board state changed. |
| `backlog.delivery-phase.created` | PROJECT | backlog-api | A delivery phase was created. |
| `backlog.delivery-phase.deleted` | PROJECT | backlog-api | A delivery phase was deleted. |
| `backlog.delivery-phase.updated` | PROJECT | backlog-api | A delivery phase was updated. |
| `backlog.delivery-phases.confirmed` | PROJECT | backlog-api | A set of delivery phases was confirmed for the project. |
| `backlog.delivery-phases.reconciled` | PROJECT | backlog-api | Delivery phases were reconciled with the underlying source content. |
| `backlog.item.created` | PROJECT | backlog-api | A backlog item was created. |
| `backlog.item.deleted` | PROJECT | backlog-api | A backlog item was deleted. |
| `backlog.item.status_changed` | PROJECT | backlog-api | A backlog item status changed. |
| `backlog.item.updated` | PROJECT | backlog-api | A backlog item was updated. |
| `backlog.sync.pulled` | PROJECT | backlog-api | Backlog items were pulled from an external source. |
| `backlog.sync.pushed` | PROJECT | backlog-api | Backlog items were pushed to an external destination. |
| `biome_host.installation.bundle_ready` | PROJECT | biome-host-api | Biome bundle fetched + verified + uploaded to S3 — ready to schedule a sidecar/HttpApi workload. |
| `biome_host.installation.state_changed` | PROJECT | biome-host-api | A BiomeInstallation transitioned between lifecycle states (pending_config → active → disabled). |
| `biome_host.org_enablement.changed` | PUBLIC | biome-host-api | An org admin changed the effective enablement state or surfaceMode of a biome for the org. |
| `biome_host.org_enablement.changed` | PUBLIC | public-gateway-api | biome-host-api signalled that an org admin changed biome enablement — gateway invalidates its reachability cache. |
| `deliverable.spec.created` | INTERNAL | deliverable-specs-api | A deliverable spec was created. |
| `external.adapter.configured` | PROJECT | connector-gateway-api | A project-level adapter binding was configured or updated. |
| `external.sync.requested` | PROJECT | connector-gateway-api | A sync was requested for a project-level adapter binding (manual or webhook-triggered). |
| `integration.integration.removed` | INTERNAL | connector-gateway-api | An organization-level integration was removed. |
| `integration.integration.removed` | INTERNAL | connector-gateway-api | Integration removed — purge org repositories + project bindings for the integration. |
| `integration.sync.completed` | PROJECT | connector-gateway-api | A scheduled or manual sync run completed. |
| `integration.sync.failed` | PROJECT | connector-gateway-api | A scheduled or manual sync run failed. |
| `kb.comment.added` | PROJECT | knowledge-base-api | A user anchored a new comment on a document page. |
| `kb.comment.resolved` | PROJECT | knowledge-base-api | A document-page comment was marked RESOLVED. |
| `kb.ingestion.completed` | PROJECT | knowledge-base-api | A KB ingestion job completed. |
| `kb.page.approved` | PROJECT | knowledge-base-api | A KB page proposal was approved (transitioned to PUBLISHED). |
| `kb.page.created` | PROJECT | knowledge-base-api | A KB page was created. |
| `kb.page.deleted` | PROJECT | knowledge-base-api | A KB page was deleted. |
| `kb.page.status_changed` | PROJECT | knowledge-base-api | A KB page status changed. |
| `kb.page.updated` | PROJECT | knowledge-base-api | A KB page was updated. |
| `kb.patch.decided` | PROJECT | knowledge-base-api | A pending patch was accepted or rejected by the user. |
| `kb.patch.proposed` | PROJECT | knowledge-base-api | A Document-Buddy agent (or workflow review activity) proposed one  |
| `kb.patch.stale` | PROJECT | knowledge-base-api | A pending patch was marked STALE because the document moved out  |
| `llm.embedding.commitment.activated` | PROJECT | llm-registry-api | Per-org embedding commitment flipped proposed → active. |
| `llm.embedding.commitment.created` | PROJECT | llm-registry-api | Per-org embedding commitment row was created (proposed state). |
| `llm.embedding.commitment.updated_same_dim` | PROJECT | llm-registry-api | Embedding model swap with matching dimension (no migration). |
| `llm.embedding.migration.completed` | PROJECT | llm-registry-api | All consumers reported done; commitment advanced to new model. |
| `llm.embedding.migration.failed` | PROJECT | llm-registry-api | A consumer failed; commitment reverted to previous model. |
| `llm.embedding.migration.progress` | PROJECT | llm-registry-api | Per-consumer migration progress heartbeat / state transition. |
| `llm.embedding.migration.rolled_back` | PROJECT | llm-registry-api | Operator rolled back an in-progress migration. |
| `llm.embedding.migration.started` | PROJECT | llm-registry-api | Dimension-change embedding migration started, or stalled-walker wakeup replay. |
| `llm.model-strategy.bound` | PROJECT | llm-registry-api | A model strategy was bound to a project. |
| `llm.model-strategy.created` | PROJECT | llm-registry-api | A model strategy was created or adopted from a system strategy. |
| `llm.model-strategy.deleted` | PROJECT | llm-registry-api | A model strategy was deleted. |
| `llm.model-strategy.entries.updated` | PROJECT | llm-registry-api | Strategy entries were replaced. |
| `llm.model-strategy.unbound` | PROJECT | llm-registry-api | A model strategy binding was removed from a project. |
| `llm.model-strategy.updated` | PROJECT | llm-registry-api | A model strategy row was updated (excluding entries). |
| `llm.model.synced` | PROJECT | llm-registry-api | Provider /models endpoint sync completed. |
| `llm.provider.created` | PROJECT | llm-registry-api | A LLM provider row was created for an org. |
| `llm.provider.deleted` | PROJECT | llm-registry-api | A LLM provider row was deleted. |
| `llm.provider.updated` | PROJECT | llm-registry-api | A LLM provider row was updated. |
| `memory.maintenance.partition.processed` | INTERNAL | memory-api | One  |
| `memory.maintenance.run.completed` | INTERNAL | memory-api | A memory-maintenance run reached a terminal state (SUCCEEDED or FAILED). |
| `memory.maintenance.run.started` | INTERNAL | memory-api | A scheduled or volume-triggered memory-maintenance run started for an org. |
| `memory.maintenance.writes_threshold_reached` | INTERNAL | memory-api | The per-org write counter crossed the maintenance volume threshold; consumers should start an out-of-band maintenance run. |
| `memory.memory.deleted` | INTERNAL | memory-api | A memory file was deleted. |
| `memory.memory.renamed` | INTERNAL | memory-api | A memory slug was renamed; the old slug is registered as a soft-redirect alias for 30 days. |
| `memory.memory.written` | INTERNAL | memory-api | An agent-driven memory write (create or append or str_replace) was applied. |
| `migration.job.completed` | PROJECT | connector-gateway-api | Migration completed successfully. |
| `migration.job.confirmed` | PROJECT | connector-gateway-api | A migration plan was confirmed and queued for execution. |
| `migration.job.failed` | PROJECT | connector-gateway-api | Migration execution failed. |
| `migration.job.started` | PROJECT | connector-gateway-api | Migration execution started. |
| `migration.plan.created` | PROJECT | connector-gateway-api | A migration plan was created (pending confirmation). |
| `org.document-template.published` | INTERNAL | artifact-store-api | Org-published document template artifact ready for pre-staging. |
| `org.document-template.published` | INTERNAL | workspace-orchestrator-api | Org-published document template artifact ready for pre-staging. |
| `org.document-template.unpublished` | INTERNAL | artifact-store-api | Org-published document template version withdrawn — triggers refcount GC. |
| `org.document-template.unpublished` | INTERNAL | workspace-orchestrator-api | Org-published document template version withdrawn — triggers refcount GC. |
| `org.document-template.updated` | INTERNAL | artifact-store-api | Org-published document template metadata or layers updated — re-materialize. |
| `org.document-template.updated` | INTERNAL | workspace-orchestrator-api | Org-published document template metadata or layers updated — re-materialize. |
| `org.document-theme.published` | INTERNAL | artifact-store-api | Org-published document theme artifact ready for pre-staging. |
| `org.document-theme.published` | INTERNAL | workspace-orchestrator-api | Org-published document theme artifact ready for pre-staging. |
| `org.document-theme.unpublished` | INTERNAL | artifact-store-api | Org-published document theme version withdrawn — triggers refcount GC. |
| `org.document-theme.unpublished` | INTERNAL | workspace-orchestrator-api | Org-published document theme version withdrawn — triggers refcount GC. |
| `org.document-theme.updated` | INTERNAL | artifact-store-api | Org-published document theme metadata or layers updated — re-materialize. |
| `org.document-theme.updated` | INTERNAL | workspace-orchestrator-api | Org-published document theme metadata or layers updated — re-materialize. |
| `org.scaffold.published` | INTERNAL | artifact-store-api | Org-published scaffold artifact ready for pre-staging into pool template shares. |
| `org.scaffold.published` | INTERNAL | workspace-orchestrator-api | Org-published scaffold artifact ready for pre-staging into pool template shares. |
| `org.scaffold.unpublished` | INTERNAL | artifact-store-api | Org-published scaffold version withdrawn — triggers refcount GC. |
| `org.scaffold.unpublished` | INTERNAL | workspace-orchestrator-api | Org-published scaffold version withdrawn — triggers refcount GC. |
| `org.scaffold.updated` | INTERNAL | artifact-store-api | Org-published scaffold metadata or layers updated — re-materialize. |
| `org.scaffold.updated` | INTERNAL | workspace-orchestrator-api | Org-published scaffold metadata or layers updated — re-materialize. |
| `organization.organization.deleted` | INTERNAL | connector-gateway-api | Organization deleted — cascade delete all SCM data. |
| `platform.workflow_runtime.namespace.provisioned` | INTERNAL | workflow-engine-api | The engine provisioned a per-organization Xema Workflow Runtime namespace (RegisterNamespace + retention + search-attrs converged). Workers should add the namespace to their polling fleet. |
| `project.bootstrap.plan.seeded` | PROJECT | project-registry-api | Bootstrap plan was seeded for the project. |
| `project.bootstrap.requested` | PROJECT | project-registry-api | Bootstrap was requested for the project. |
| `project.integration.updated` | PROJECT | project-registry-api | A project integration was updated. |
| `project.manifest.updated` | PROJECT | project-registry-api | The project manifest was updated. |
| `project.project.created` | PROJECT | connector-gateway-api | Project created — auto-provision Gitea repository. |
| `project.project.created` | PROJECT | project-registry-api | A project was created. |
| `project.project.deleted` | PROJECT | connector-gateway-api | Project deleted — cascade delete repositories. |
| `project.project.deleted` | PROJECT | project-registry-api | A project was deleted. Canonical signal for cascade cleanup across the platform. |
| `project.project.updated` | PROJECT | project-registry-api | Editable project metadata was updated. |
| `project.repo.linked` | PROJECT | project-registry-api | A repository was linked to the project. |
| `project.role.granted` | PROJECT | project-registry-api | A project role was granted to a user. |
| `project.role.revoked` | PROJECT | project-registry-api | A project role was revoked from a user. |
| `project.settings.updated` | PROJECT | project-registry-api | Project settings were updated. |
| `search.deadletter.created` | PROJECT | search-api | A search-related event could not be processed and was moved to deadletter. |
| `search.document.deleted` | PROJECT | search-api | Search documents were deleted. |
| `search.document.indexed` | PROJECT | search-api | Search documents were indexed. |
| `search.reindex.completed` | INTERNAL | search-api | Search reindexing job completed successfully. |
| `search.reindex.failed` | INTERNAL | search-api | Search reindexing job failed. |
| `search.reindex.started` | INTERNAL | search-api | Search reindexing job started. |
| `session.command.executed` | USER | agent-session-api | Xema Agent Runtime executed a slash-command inside the session (e.g. /compact, /share). Audit + UI feedback. |
| `session.diff.changed` | USER | agent-session-api | Xema Agent Runtime reported a workspace diff change. Frontend uses this to refresh the diff panel without polling. |
| `session.file.edited` | USER | agent-session-api | A file in the agent workspace was edited. |
| `session.git_status.changed` | PROJECT | agent-session-api | Session workspace git state flipped (branch / push / PR). |
| `session.git.conflict-dispatch-acknowledged` | PROJECT | agent-session-api | agent-session-api received  |
| `session.history.compacted` | USER | agent-session-api | Xema Agent Runtime compacted the session history (older messages summarized into a compaction part). FE should refresh its message list cursor. |
| `session.idle.changed` | USER | agent-session-api | Session went idle / active. Drives typing indicators. |
| `session.lifecycle.changed` | PROJECT | agent-session-api | Coarse session-row change ping (created/terminated/etc). |
| `session.message.part.removed` | USER | agent-session-api | A previously streamed message part was removed (e.g. retry). |
| `session.message.part.updated` | USER | agent-session-api | Streaming chunk of an LLM message part. |
| `session.message.removed` | USER | agent-session-api | A message was removed from the session (e.g. user undo). |
| `session.message.updated` | USER | agent-session-api | A message frame was finalised (full assembly after streaming) or otherwise replaced. |
| `session.output-surface.changed` | PROJECT | agent-session-api | Session output surface app status changed. |
| `session.permission.replied` | USER | agent-session-api | A permission request was answered. Distinct from  |
| `session.permission.requested` | USER | agent-session-api | Xema Agent Runtime asked the user for permission to perform an action. |
| `session.permission.resolved` | USER | agent-session-api | A permission request was resolved by the user. |
| `session.provisioning.changed` | PROJECT | agent-session-api | Session provisioning phase transitioned. |
| `session.runtime.connected` | USER | agent-session-api | Xema Agent Runtime HTTP server announced itself on the SSE stream. Useful as a heartbeat / reconnect signal in the UI. |
| `session.runtime.created` | USER | agent-session-api | Xema Agent Runtime runtime created a new session row (the runtime-side counterpart to our DB session). Used to detect cold-start session lifecycle. |
| `session.runtime.deleted` | USER | agent-session-api | Session was deleted from the Xema Agent Runtime runtime. |
| `session.runtime.errored` | USER | agent-session-api | A session-scoped error surfaced from Xema Agent Runtime. |
| `session.runtime.installation_updated` | USER | agent-session-api | Xema Agent Runtime runtime detected an installation/upgrade change. UIs may want to surface a  |
| `session.runtime.ratelimited` | USER | agent-session-api | Session hit a model / provider rate limit. |
| `session.runtime.status_changed` | USER | agent-session-api | Xema Agent Runtime runtime reported a status transition for the session (idle / busy / retrying). Drives typing indicators and retry banners. |
| `session.runtime.updated` | USER | agent-session-api | Session metadata changed in the Xema Agent Runtime runtime (title, share state, etc.). |
| `session.tasks.changed` | USER | agent-session-api | Xema Agent Runtime todo list for the session changed. FE refreshes the task panel. |
| `session.terminal.changed` | USER | agent-session-api | A terminal (pty) attached to the session was created, updated, exited or deleted. Single descriptor; consumers discriminate on  |
| `session.tool.call.completed` | USER | agent-session-api | A tool invocation finished successfully. |
| `session.tool.call.failed` | USER | agent-session-api | A tool invocation failed. |
| `session.tool.call.started` | USER | agent-session-api | A tool invocation is about to run. |
| `session.tools.changed` | PROJECT | agent-session-api | Session tool catalog (MCP / skill) changed. |
| `user-hub.notification.created` | USER | user-hub-api | A notification was created for a single target user. |
| `user-hub.notification.status_changed` | USER | user-hub-api | A notification transitioned between lifecycle states. |
| `user-hub.notification.user_state_changed` | USER | user-hub-api | A user-initiated notification state change (read / dismiss). |
| `workflow.activity.attempt_failed` | PROJECT | Xema workflow worker service | A Xema runtime activity attempt failed and is being retried (bridge: synthesized from describeWorkflowExecution.pendingActivities). |
| `workflow.activity.cancel_requested` | PROJECT | Xema workflow worker service | Cancellation requested for a Xema runtime activity task. |
| `workflow.activity.completed` | PROJECT | Xema workflow worker service | A Xema runtime activity task completed (bridge: ActivityTaskCompleted). |
| `workflow.activity.deliverable.self-correction-failed` | PROJECT | Xema workflow worker service | Re-harvest after the self-correction message still failed validation. The activity throws DELIVERABLE_CONTRACT_VIOLATED (non-retryable) and the workflow terminates cleanly. |
| `workflow.activity.deliverable.self-correction-started` | PROJECT | Xema workflow worker service | Agent activity sent the structured correction follow-up message into the same Xema Agent Runtime session (turnId reused). Frontend shows  |
| `workflow.activity.deliverable.self-correction-succeeded` | PROJECT | Xema workflow worker service | Re-harvest after the self-correction message produced a deliverable that satisfies the spec contract. The activity returns the canonical envelope with  |
| `workflow.activity.deliverable.validation-failed` | PROJECT | Xema workflow worker service | Agent activity harvested its workspace and the deliverable spec output contract failed. Carries  |
| `workflow.activity.failed` | PROJECT | Xema workflow worker service | A Xema runtime activity task failed (bridge: ActivityTaskFailed). |
| `workflow.activity.heartbeat` | PROJECT | Xema workflow worker service | A worker activity reported in-progress mid-execution. |
| `workflow.activity.scheduled` | PROJECT | Xema workflow worker service | A Xema runtime activity task was scheduled (bridge: ActivityTaskScheduled). |
| `workflow.activity.started` | PROJECT | Xema workflow worker service | A Xema runtime activity task started (bridge: ActivityTaskStarted). |
| `workflow.activity.step` | PROJECT | Xema workflow worker service | Activity-internal step progress (THINKING / EDITING_FILE / RUNNING_COMMAND / ...). Replaces the legacy in-memory RunProgressFanoutService path. |
| `workflow.activity.timed_out` | PROJECT | Xema workflow worker service | A Xema runtime activity task timed out (bridge: ActivityTaskTimedOut). |
| `workflow.child.canceled` | PROJECT | Xema workflow worker service | A child workflow execution was canceled (bridge: ChildWorkflowExecutionCanceled). |
| `workflow.child.completed` | PROJECT | Xema workflow worker service | A child workflow execution completed (bridge: ChildWorkflowExecutionCompleted). |
| `workflow.child.failed` | PROJECT | Xema workflow worker service | A child workflow execution failed (bridge: ChildWorkflowExecutionFailed). |
| `workflow.child.started` | PROJECT | Xema workflow worker service | A child workflow execution started (bridge: ChildWorkflowExecutionStarted). |
| `workflow.child.timed_out` | PROJECT | Xema workflow worker service | A child workflow execution timed out (bridge: ChildWorkflowExecutionTimedOut). |
| `workflow.inquiry.cancelled` | PROJECT | workflow-engine-api | A pending inquiry was cancelled (parent run cancelled, or explicit cancel). |
| `workflow.inquiry.created` | PROJECT | workflow-engine-api | An inquiry was created and is awaiting recipient replies (decision gate or agent tool inquiry). |
| `workflow.inquiry.escalated` | PROJECT | workflow-engine-api | An inquiry advanced to the next escalation level: previous recipients skipped, new recipients added, deadline reset. |
| `workflow.inquiry.reply` | PROJECT | workflow-engine-api | A recipient submitted a reply on an inquiry. |
| `workflow.inquiry.resolved` | PROJECT | workflow-engine-api | An inquiry reached a terminal verdict (recipient policy satisfied, or expired). |
| `workflow.job.changed` | PROJECT | workflow-engine-api | A job within a run changed status. |
| `workflow.marker.recorded` | PROJECT | Xema workflow worker service | A Xema runtime marker was recorded (bridge: MarkerRecorded — sideEffect, upsertSearchAttributes, etc.). |
| `workflow.run.canceled` | PROJECT | Xema workflow worker service | Workflow run was canceled (bridge: WorkflowExecutionCanceled). |
| `workflow.run.completed` | PROJECT | workflow-engine-api | A run completed successfully. |
| `workflow.run.continued_as_new` | PROJECT | Xema workflow worker service | Workflow run continued-as-new (bridge: WorkflowExecutionContinuedAsNew). |
| `workflow.run.created` | PROJECT | workflow-engine-api | A new pipeline run was dispatched. |
| `workflow.run.failed` | PROJECT | workflow-engine-api | A run failed. |
| `workflow.run.milestone` | PROJECT | workflow-engine-api | A coarse milestone within a run — activity start/complete/awaiting-input — emitted by the runtime worker through the engine. |
| `workflow.run.started` | PROJECT | workflow-engine-api | A pipeline run started executing on the Xema workflow worker service (mapped from WorkflowExecutionStarted history event). |
| `workflow.run.status_changed` | PROJECT | workflow-engine-api | A run transitioned between status states. |
| `workflow.run.timed_out` | PROJECT | Xema workflow worker service | Workflow run timed out (bridge: WorkflowExecutionTimedOut). |
| `workflow.signal.received` | PROJECT | Xema workflow worker service | Workflow received a signal (bridge: WorkflowExecutionSignaled). |
| `workflow.timer.canceled` | PROJECT | Xema workflow worker service | A Xema runtime timer was canceled (bridge: TimerCanceled). |
| `workflow.timer.fired` | PROJECT | Xema workflow worker service | A Xema runtime timer fired (bridge: TimerFired). |
| `workflow.timer.started` | PROJECT | Xema workflow worker service | A Xema runtime timer was started (bridge: TimerStarted). |
| `workflow.update.accepted` | PROJECT | Xema workflow worker service | A workflow update was accepted (bridge: WorkflowExecutionUpdateAccepted). |
| `workflow.update.completed` | PROJECT | Xema workflow worker service | A workflow update completed (bridge: WorkflowExecutionUpdateCompleted). |
| `workflow.update.rejected` | PROJECT | Xema workflow worker service | A workflow update was rejected (bridge: WorkflowExecutionUpdateRejected). |
| `workload.lifecycle.degraded` | INTERNAL | workload-runtime-api | Workload partial outage detected (replicas below minimum). |
| `workload.lifecycle.deleted` | INTERNAL | workload-runtime-api | Workload deleted. Terminal. |
| `workload.lifecycle.draining` | INTERNAL | workload-runtime-api | Workload entering drain phase before deletion. |
| `workload.lifecycle.failed` | INTERNAL | workload-runtime-api | Workload failed terminally — retries exhausted or fatal error. |
| `workload.lifecycle.ready` | INTERNAL | workload-runtime-api | Workload is healthy and discoverable. Carries endpoint or connection info. |
| `workload.lifecycle.scheduled` | INTERNAL | workload-runtime-api | Workload accepted by the scheduler — backend objects are being created. |
| `workspace-git.conflict.dispatch-requested` | PROJECT | workspace-git-api | A publish-to-production attempt hit a remote-fast-forward conflict;  |
| `xema.biome.installation.lifecycle.changed.v1` | PROJECT | biome-host-api | A BiomeInstallation traversed a capability-gated lifecycle transition. |
| `xema.composition.published.v1` | PROJECT | llm-registry-api | A draft Agent Composition was published as a new immutable version.  |
| `xema.kernel.released` | INTERNAL | workspace-orchestrator-api | Kernel image released — triggers an immediate SyncSystemTemplates run. |
| `xema.store.install.created.v1` | PROJECT | xema-store-api | A new StoreInstall row was committed. biome-host-api consumes this to materialize the install runtime. |
<!-- AUTO-GENERATED:REALTIME_EVENTS_END -->

## Frame Handling Pattern

### 1) Open unified stream

```ts
const stream = createAuthenticatedSseClient({
  url: '/realtime/stream',
  orgId,
  getToken,
  lastEventId: loadCursorMap(),
});
```

### 2) Subscribe to project/session scopes as needed

```ts
await fetch(`/realtime/streams/${connectionId}/subscriptions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ scope: 'project', id: projectId }),
});
```

### 3) Apply invalidation, then refetch authoritative state

```ts
stream.onMessage((envelope) => {
  switch (envelope.type) {
    case 'workflow.run.completed':
    case 'artifact.row.changed':
    case 'kb.page.created': {
      invalidateRelevantQueries(envelope);
      break;
    }
    default: {
      // Unknown events should be ignored safely.
      break;
    }
  }
});
```

### 4) Parse as CloudEvents envelope first, then route by `type`

```ts
stream.onMessage((envelope) => {
  if (typeof envelope.type !== 'string') return;

  // Defensive checks for scope-sensitive experiences.
  if (envelope.ehvisibility === 'project' && envelope.ehprojectid !== currentProjectId) {
    return;
  }

  routeRealtimeEvent(envelope.type, envelope);
});
```

## Control Frame Behavior

Common control events to handle explicitly:

- connected: capture `connectionId` and server cursors.
- heartbeat: reset liveness watchdog.
- subscribed/unsubscribed: confirm scope changes.
- scope_denied: keep UI stable and show access notice.
- resync: clear stored cursors and reconnect with full refetch.
- goodbye: close gracefully and reconnect with backoff.

## Swagger Gap and Consumer Guidance

Stream payload details (control frames, envelope fields, replay cursors, and materialized-vs-realtime-only distinctions) are not fully represented in Swagger schemas. For implementation correctness, treat this page plus the streaming guide as the primary contract for realtime consumption behavior.

## Example: Resync Recovery

```ts
stream.onControl('resync', () => {
  clearRealtimeCursorState();
  invalidateAllCriticalQueries();
  stream.reconnect({ lastEventId: '{"global":"0"}' });
});
```

## Example: Feed + Realtime UX

A practical pattern for activity surfaces:

1. Load feed inbox/project list via feed endpoints.
2. Open unified realtime stream.
3. On frame arrival, invalidate only affected query keys.
4. Keep unread counters driven by cursor updates and feed refetch.
5. On disconnect, reconnect with jittered backoff and stored cursor map.

This gives responsive UX without over-fetching or coupling UI state to raw frame internals.

---

**Previous**: [← Streaming and SSE Guide](./03-streaming-and-sse-guide.md)
