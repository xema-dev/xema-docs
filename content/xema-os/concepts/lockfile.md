---
slug: lockfile
title: Lockfile
summary: A deterministic record, written at biome install time, of the exact versions of every contributed object the install pinned. Lockfiles make installs reproducible, drift detectable, and rollbacks possible.
relatedCommands: ["xema biome install"]
relatedCapabilities: ["biome:install@1"]
relatedZones: ["org"]
stability: stable
---

A lockfile is the audit trail of an install. When `biome:install@1`
runs, the kernel resolves every [contribution](./contribution.md) in
the [manifest](./manifest.md) to a concrete `slug@version` and writes
the resulting map to an `install.lock` row keyed by
`(org, biome, version)`. Subsequent boots re-read the lockfile rather
than re-resolving — so a biome that has been live for months continues
to behave identically even if upstream sources change. Lockfiles only
reference `published` versions ([lifecycle](./lifecycle.md));
[archived](./lifecycle.md) versions stay resolvable for as long as a
lockfile names them.

Lockfiles are produced by the shared resolver in
`@xemahq/lockfile-resolver` and written at three invocation
boundaries: app deploy
(`POST /apps/:id/lockfile/refresh` on `app-platform-api`),
session creation (`agent-session-api`'s `SessionLockfileService`,
served at `GET /sessions/:id/lockfile`), and workflow-run start
(the Xema workflow worker service's `xemaEmitRunLockfileActivity`, written
as a `REPLACE`-versioned artifact). The shared
`@xemahq/lockfile-sources-nest` package provides the cross-service
source layer. See the [Versioning page](../versioning.md#lockfile-shape)
for the lockfile shape.
