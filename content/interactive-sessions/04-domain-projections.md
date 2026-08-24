# Domain Projections and Custom Session Modes

Interactive sessions now run on a single shared runtime, and product/domain features are built as **domain projections** on top of that runtime. This keeps chat transport, streaming, and lifecycle behavior consistent while letting you ship new session experiences quickly.

---

## What Changed

The platform now treats session behavior in two layers:

- **Runtime layer** (`agent-session-api`) owns message turns, streaming, worker/session lifecycle, and state transitions.
- **Domain layer** (for example brainstorming or a custom product service) owns domain metadata, curation, handoff, and domain events.

Domain services should no longer implement their own chat/SSE transport or provisioning reconciliation loop.

---

## Deterministic Domain Marker Resolution

When a session is created with a domain marker:

- `sessionDomainKey` identifies the projection kind (closed domain marker)
- `sessionDomainRef` identifies the domain row

The runtime resolves the effective published Agent deterministically from `sessionDomainKey`.

Rules:

- If `sessionDomainKey` is present and `agentRef` is omitted, the runtime resolves the Agent from the domain marker.
- If an explicit `agentRef` conflicts with the domain's registered Agent, creation fails fast.
- If neither `agentRef` nor a resolvable domain marker is present, creation fails fast.

This removes service-level hardcoding and keeps profile selection biome-driven.

---

## Build a New Mode (Non-Brainstorming Example)

This example creates a **Design Review** domain projection that reuses the same interactive session runtime.

For a complete implementation walkthrough, see [Example: Design Review Projection](./examples/01-design-review-projection.md).

### 1. Define the domain row in your service

```ts
// design-review.service.ts
type DesignReviewRow = {
  id: string;
  orgId: string;
  projectId: string;
  title: string;
  status: 'active' | 'completed' | 'archived';
  agentSessionId: string | null;
};
```

### 2. Create the domain row, then provision runtime session via domain marker

```ts
// design-review.service.ts
import { randomUUID } from 'node:crypto';

const DESIGN_REVIEW_DOMAIN_KEY = 'design-review';

async function createDesignReview(params: {
  orgId: string;
  projectId: string;
  title: string;
  userAccessToken: string;
}): Promise<{ reviewId: string; agentSessionId: string }> {
  const reviewId = randomUUID();

  // 1) Create your domain row first (transaction omitted for brevity)
  await db.designReview.create({
    data: {
      id: reviewId,
      orgId: params.orgId,
      projectId: params.projectId,
      title: params.title,
      status: 'active',
      agentSessionId: null,
    },
  });

  // 2) Ask agent-session runtime to create the backing session
  //    No hardcoded Agent ref is needed when the domain mapping owns it.
  const sessionRes = await fetch(`${process.env.AGENT_SESSION_API_URL}/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.userAccessToken}`,
      'Content-Type': 'application/json',
      'X-Org-Id': params.orgId,
      'X-Project-Id': params.projectId,
    },
    body: JSON.stringify({
      title: `Design Review: ${params.title}`,
      sessionDomainKey: DESIGN_REVIEW_DOMAIN_KEY,
      sessionDomainRef: reviewId,
    }),
  });

  if (!sessionRes.ok) {
    throw new Error(`session create failed (${sessionRes.status})`);
  }

  const sessionEnvelope = await sessionRes.json();
  const agentSessionId = sessionEnvelope.data.id as string;

  await db.designReview.update({
    where: { id: reviewId },
    data: { agentSessionId },
  });

  return { reviewId, agentSessionId };
}
```

### 3. Route UI chat to the same runtime endpoints

Use the same runtime endpoints used by generic sessions:

- `POST /sessions/{id}/threads/{threadId}/messages` for turns
- `GET /sessions/{id}/events/stream` for persistent realtime updates

Keep design-review UI additive (extra panels, badges, metadata), while transcript and stream components remain shared.

The runtime derives `createdBy` from the bearer token on `POST /sessions`.

### 4. Enforce one active mapping invariant

For each active design-review row, enforce exactly one active backing session.

Suggested invariant checks:

- domain row cannot enter `active` without `agentSessionId`
- no second active session can be bound to the same domain row
- archive/restart flows must update both runtime and projection state deterministically

---

## Biome-Driven Agent and Workspace Selection

For new domain modes:

- register the domain-to-Agent configuration in biome content
- resolve the published Agent and workspace from the domain marker
- do not hardcode retired session-profile constants in domain services

This keeps one runtime and one manifest model while allowing many projection modes.

---

## Verification Checklist for New Modes

- Chat traffic goes through agent-session runtime endpoints only
- Realtime stream contract matches generic interactive sessions
- Domain service does not own runtime reconciliation loops
- Concurrent sends/restarts/archives do not drift lock/state
- Invalid or missing domain/profile mapping fails fast

---

**Previous**: [← API Reference](./03-api-reference.md)
