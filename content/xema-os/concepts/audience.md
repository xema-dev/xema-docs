---
slug: audience
title: Audience
summary: A typed group of subjects that can be addressed as a unit — users, service accounts, external identities, or membership-derived sets. Audiences are how Xema scopes notifications, sharing, and capability grants without enumerating individual subjects.
relatedCommands: []
relatedCapabilities: []
relatedZones: ["org"]
stability: stable
---

Audiences sit between raw subjects and the policy plane. An audience
resolves at runtime to a concrete set of recipients (members of a
project, holders of a role, owners of an [app](./app.md), …) and feeds
notification routing, sharing dialogs, and bulk grants. Each audience
is governed by an `audience-policy` [object](./object.md) that declares
how it resolves, who may target it, and what scope it operates in.
For apps, the audience kind is closed: `internal-org` (Xema-identity
users), `external-subject` (non-Xema users authenticated by the app
and granted a [delegated-session](./delegated-session.md)), or
`public-anon` (anonymous, tightly-constrained capability surface).
Audiences are how the platform stays scalable as the subject graph
grows — you grant capabilities to a role, not to a snapshot of
individuals. See the [Apps page](../apps.md) for the audience-policy
endpoints on `app-platform-api`.
