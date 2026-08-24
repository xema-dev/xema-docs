# Example: Design Review Projection

This guide shows how to build a **Design Review** mode on top of the shared agent-session runtime. It uses domain markers for deterministic profile/manifest resolution and keeps chat/SSE behavior identical to generic sessions.

---

## Goal

Create a new product mode where each design-review row maps to one backing interactive session, while reusing the same runtime endpoints for send-message and streaming.

---

## Step 1: Create Domain Model

Your domain service owns product metadata and projection state.

```ts
export type DesignReviewStatus = 'active' | 'completed' | 'archived';

export interface DesignReviewRow {
  id: string;
  orgId: string;
  projectId: string;
  title: string;
  summary: string | null;
  tags: string[];
  status: DesignReviewStatus;
  agentSessionId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

Enforce this invariant in your data model: one active design-review row maps to one active backing session.

---

## Step 2: Create Domain Row and Backing Session

Use the runtime create endpoint with `sessionDomainKey` and `sessionDomainRef`.

```ts
import { randomUUID } from 'node:crypto';

const DESIGN_REVIEW_DOMAIN_KEY = 'design-review';

export async function createDesignReview(input: {
  orgId: string;
  projectId: string;
  actorId: string;
  title: string;
  userAccessToken: string;
}): Promise<{ reviewId: string; sessionId: string }> {
  const reviewId = randomUUID();

  await db.designReview.create({
    data: {
      id: reviewId,
      orgId: input.orgId,
      projectId: input.projectId,
      title: input.title,
      summary: null,
      tags: [],
      status: 'active',
      agentSessionId: null,
      createdBy: input.actorId,
    },
  });

  const res = await fetch(`${process.env.AGENT_SESSION_API_URL}/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.userAccessToken}`,
      'Content-Type': 'application/json',
      'X-Org-Id': input.orgId,
      'X-Project-Id': input.projectId,
    },
    body: JSON.stringify({
      title: `Design Review: ${input.title}`,
      sessionDomainKey: DESIGN_REVIEW_DOMAIN_KEY,
      sessionDomainRef: reviewId,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create backing session (${res.status})`);
  }

  const envelope = await res.json();
  const sessionId = envelope.data.id as string;

  await db.designReview.update({
    where: { id: reviewId },
    data: { agentSessionId: sessionId },
  });

  return { reviewId, sessionId };
}
```

Important behavior:

- You can omit `agentRef` when `sessionDomainKey` resolves a registered domain Agent.
- Runtime resolves profile deterministically from the domain marker.
- Invalid mapping fails fast.
- The actor is derived from the bearer token on `POST /sessions`.

---

## Step 3: Resolve Session ID in Your UI/API

Provide a deterministic resolver from design-review id to session id.

```ts
export async function getDesignReviewSessionId(params: {
  orgId: string;
  projectId: string;
  reviewId: string;
}): Promise<string> {
  const row = await db.designReview.findUnique({
    where: { id: params.reviewId },
    select: { orgId: true, projectId: true, agentSessionId: true, status: true },
  });

  if (!row) throw new Error('Design review not found');
  if (row.orgId !== params.orgId || row.projectId !== params.projectId) {
    throw new Error('Cross-tenant access denied');
  }
  if (row.status !== 'active') throw new Error('Design review is not active');
  if (!row.agentSessionId) throw new Error('Backing session is missing');

  return row.agentSessionId;
}
```

---

## Step 4: Send Message via Shared Runtime Endpoint

```bash
curl -X POST "https://agent-session-api.xema.dev/sessions/${SESSION_ID}/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: $ORG_ID" \
  -H "X-Project-Id: $PROJECT_ID" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"content":"Review this architecture decision record and suggest risks."}'
```

No custom design-review message endpoint is required.

---

## Step 5: Consume Shared Session Stream Contract

Use the same stream contract your generic session console already handles.

- stream event envelope remains consistent
- ordering and replay behavior remains consistent
- domain UI remains additive (status badges, curation panels, handoff controls)

---

## Step 6: Add Projection-Specific Behavior Only

Keep domain logic focused on projection concerns:

- summary and tags curation
- design-review-specific handoff into a pipeline
- domain events derived from runtime source-of-truth events

Do not re-implement runtime provisioning loops, turn locking, or SSE transport.

---

## Validation Checklist

- Concurrent sends do not bypass runtime turn lock.
- Session create fails fast on invalid domain/profile mapping.
- Restart/archive updates maintain one active mapping invariant.
- Design-review mode uses exact same runtime message and stream behavior as generic sessions.

---

**Previous**: [← Examples overview](./index.md)
