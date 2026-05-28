# Notifications

> API Docs: https://user-hub-api.xema.dev/api/docs

The **notifications** surface is how Xema tells a user something needs their attention — an approval to review, a pipeline that finished, a comment on their work — and how the platform tracks the lifecycle of each item from arrival through response.

A notification is a durable, server-authoritative record. It survives page refreshes, follows the user across devices, and updates in real time when its underlying state changes. Authors don't write notification code: notifications are derived from events the platform already emits.

## Quick Links

| Page | What it covers |
|---|---|
| [01 Overview](./01-overview.md) | Lifecycle states, the bell badge, multi-device behaviour |
| [02 Recipients](./02-recipients.md) | Who can answer an inquiry — humans, agents, endpoints, groups |
| [03 Groups](./03-groups.md) | Author reusable groups of users and address them from a workflow |

## Getting Started

Ordered reading path:

1. **[Overview](./01-overview.md)** — understand what a notification is and how it transitions between states.
2. **[Recipients](./02-recipients.md)** — see how inquiries route to humans, agents, external endpoints, or groups.
3. **[Groups](./03-groups.md)** — define a named group once and reuse it as a recipient anywhere.

## FAQ

**Q: Will I miss a notification if I'm offline?**
A: No. Every notification is persisted; when you come back online, the bell badge reflects the current state.

**Q: What happens to my pending tasks when a workflow is cancelled?**
A: They cascade to a cancelled state automatically. The badge clears within seconds without a refresh.

**Q: How does Xema know I'm online?**
A: Every active browser session updates a presence record on a 15-second heartbeat. When the page closes the record clears within two minutes.

**Q: Can I be notified by something other than the in-app bell?**
A: Yes — additional channels (email, push, third-party messengers) plug into the same fabric. Each user can opt every category to a different channel and gate noisy channels by presence ("only message me when I'm offline").
