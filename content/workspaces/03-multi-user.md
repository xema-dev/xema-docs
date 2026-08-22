# Multi-User Sessions

Multiple people and agents can collaborate in the same workspace session. A **participant** is any actor — human user, agent identity, or CI subject — that has joined an active session.

---

## Participant model

Every session has a **participant table**: a list of actors that may write to the session and receive events from it.

```ts
interface SessionParticipant {
  actorId: string;            // user ID, agent ID, or CI subject ID
  actorKind: 'user' | 'agent' | 'ci';
  role: 'owner' | 'collaborator' | 'observer';
  joinedAt: Date;
}
```

| Role | Can write | Can send messages | Can archive session |
|---|---|---|---|
| `owner` | yes | yes | yes |
| `collaborator` | yes | yes | no |
| `observer` | no | no | no |

The session owner is the actor that created the session. Ownership can be transferred explicitly.

---

## Joining a session

A user joins via the Xema UI: **Sessions → [session name] → Join**. An agent joins programmatically by being invited through the session's participants API — `POST /sessions/{sessionId}/participants`, the capability `agent-runtime:session.participants.create@1`. CI subjects join via the session API with a service token.

Authority for that call is the caller's role **on this session**, resolved from the session itself: the creator is its owner, an already-invited participant carries the role its row records, and a caller admitted only through a shared resource is an observer. Membership changes are the owner's and collaborators' to make; an observer cannot invite. There is no org-wide "may invite into any session" grant — a role on a session comes from that session.

Observer access is granted automatically to org members who have read access to the session's project. They see the live transcript and workspace state but cannot contribute.

---

## Actor attribution

Every message, file change, and capability call in a multi-user session carries an `actorId`. This attribution is:

- Written to the turn record (persisted with the session).
- Included in auto-commits (`git commit --author "Agent Name <agent@xema.dev>"`).
- Surfaced in the audit log with the actor's display name.
- Visible in the session transcript UI with distinct visual badges per actor.

Attribution is serialized in the mid-turn queue — actors take turns, they do not write simultaneously to the same files. The platform enforces turn order to prevent merge conflicts inside the session.

---

## External sharing

A session can be shared with non-Xema users through the **App** model. An app with an `AudiencePolicy` that includes `ExternalSubject` allows embedding the session interface in an external product.

External participants see a scoped view of the session — only the capability surface declared in the App's policy. They cannot access org storage, other sessions, or internal platform surfaces.

See [Apps](../xema-os/apps.md) for the full App and AudiencePolicy model.

---

**Previous**: [← Git Workflow](./02-git-workflow.md)

**Next**: [Worker Runtime →](./04-worker-runtime.md)
