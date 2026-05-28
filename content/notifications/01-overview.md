# Overview

Every actionable thing a user needs to see in Xema — a task awaiting their reply, a workflow that finished, a comment on a deliverable — surfaces as a **notification**. Notifications are persisted, multi-device, and lifecycle-aware so the bell icon and the tasks page always agree on what still needs attention.

---

## The bell badge

The bell icon in the top bar shows the count of unread notifications for the current organization. Clicking it opens the inbox. The badge is fed from a single durable source — the same one the tasks page reads — so the two surfaces never disagree.

A second badge on the sidebar **Tasks** entry shows pending inquiries (a subset filtered to actionable items). Both badges live on the same data; closing a task drops both counts in lock-step.

---

## Lifecycle

Each notification carries a closed-set `status` field. Transitions are owned by Xema; clients never write status directly, they only read it.

| Status | Meaning |
|---|---|
| `pending` | A reply or action is needed from this user. Counts toward the tasks badge. |
| `responded` | The user replied; the inquiry is still open for other recipients. Stays visible but no longer pulses the badge. |
| `resolved` | The inquiry reached a terminal verdict. Removed from the active count. |
| `cancelled` | The inquiry was withdrawn (or the parent workflow was cancelled). |
| `expired` | The inquiry's deadline passed without a verdict. |
| `info` | Terminal-on-arrival — informational notifications (run completed, code pushed) that have no actionable lifecycle. |

Transitions are deterministic. When the user replies, only that user's row flips to `responded`; other recipients of the same inquiry stay `pending` until they reply or the policy resolves the inquiry. When the parent workflow is cancelled, every still-active inquiry notification under that run cascades to `cancelled` automatically.

---

## Multi-device and refresh-survives

Notifications are stored per user on the server, not per device. Every browser session, mobile app, or other client signed in as the same user reads the same rows. Closing a tab and re-opening hours later shows the correct state: the badge count, the pending tasks list, and the lifecycle of every individual item are server-authoritative.

Realtime updates flow through a per-user channel: when a notification arrives or changes status, every connected device for that user receives the update within ~1 second without a refresh.

---

## Read, seen, dismissed

Three orthogonal user-facing flags live alongside the lifecycle status:

- **`readAt`** — set when the user opens the notification. Lifecycle keeps moving even if the user never reads it (an `info` row stays `info` whether read or not).
- **`seenAt`** — set when the user just scrolls past the notification in the bell dropdown. Clears the "new item" pulse without consuming the unread count.
- **`dismissedAt`** — permanent hide from the inbox. Doesn't affect lifecycle.

The bell badge reflects unread + still-active items. Dismissing a row removes it from the inbox; the lifecycle continues to advance underneath, and downstream surfaces (audit, history) can still see it.

---

## Phantom prevention

Three layers guard against notifications that outlive what they describe:

1. **Per-row `expiresAt`** — every notification can carry a server-side TTL (e.g. an inquiry's deadline). When the deadline passes, a sweep marks the row `expired`.
2. **Cascade on parent termination** — when a workflow run fails, is cancelled, or is terminated, every active inquiry notification scoped to that run cascades to `cancelled` in a single transaction.
3. **Daily self-heal** — a probe runs once a day for every notification still active beyond a staleness window, verifies the underlying inquiry still exists, and cancels any that don't. Catches missed cascade events from rare delivery failures.

Together these guarantee the badge never points at a thing that's gone.

---

**Next**: [Recipients →](./02-recipients.md)
