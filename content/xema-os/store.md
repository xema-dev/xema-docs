# Xema Store

> API Docs: https://xema-store-api.xema.dev/api/docs

The **Xema Store** is the canonical distribution surface for biomes. It is not a marketplace in the colloquial sense — Store listings are first-class XVFS objects (`xema://store/biome/<id>`), every listing operation is a capability call, and submission, review, approval, and install are biome [lifecycle](./biomes.md#the-biome-lifecycle) transitions, not free-form CRUD.

The Store sits under `/store/...` in [XVFS](./concepts/xvfs.md). The owning service is **`xema-store-api`**, which `app-runtime-api` and `biome-host-api` consume through capabilities only — never through direct DB access.

---

## The five Store capabilities

| Capability | Purpose | Endpoints that enforce it |
|---|---|---|
| `store:biome.list@1` | Catalog list / detail / version read; review-log read | `GET /listings`, `GET /listings/:id`, `GET /listings/:id/versions`, `GET /listings/:id/versions/:version` |
| `store:biome.submit@1` | Create a listing (admin); submit a version; comment on a submission | `POST /listings`, `POST /submissions`, `POST /submissions/:version/comment` |
| `store:biome.approve@1` | Approve or reject a submitted version | `POST /submissions/:version/approve`, `POST /submissions/:version/reject` |
| `store:biome.install@1` | Install a `store-approved` version into an org / project | `POST /listings/:id/versions/:version/install`, `POST /installs/:id/uninstall` |
| `store:biome.archive@1` | Archive a listing or submission | `POST /listings/:id/archive`, `POST /submissions/:version/archive` |

Every privileged endpoint validates through `xema-capability-router` before the DB write. The five refs are the only authorization surface — there is no implicit admin override.

---

## Listing lifecycle

A Store listing is `XemaObjectKind.Biome` with a [BiomeLifecycle](./biomes.md#the-biome-lifecycle) stage and one or more published versions:

```
listing (created)
  ↓
  versions[]
    each version: store-submitted → store-approved → archived
                                  ↘ rejected (terminal)
```

Submitting a version writes a `StoreListingVersion` row with lifecycle `store-submitted`. Approval flips it to `store-approved`; rejection is terminal and records a `ReviewLog` entry. Archive is a separate transition reachable from any non-rejected state.

Listings themselves can also be archived; archive of a listing implicitly hides all its versions from new installs but keeps existing installs functional (they reference the version through their [lockfile](./versioning.md)).

---

## Install flow

`POST /listings/:id/versions/:version/install` is the single install entry point:

1. Caller hands `{ orgId, projectId?, environment, scope }` to `xema-store-api`.
2. The service validates the caller's `store:biome.install@1` grant through `xema-capability-router`.
3. It refuses when the version is not in lifecycle `store-approved` or when the listing is archived — fail-fast, no silent fallback.
4. It writes a `StoreInstall` row and emits the CloudEvent `xema.store.install.created.v1` on `event-hub-api`.
5. `biome-host-api` subscribes to that event, fetches the bundle, computes the permission digest, and proceeds with the [Stage 1 install flow](./biomes.md#install--stage-1-consent).

The `BiomeInstallation.storeInstallId` natural-key column closes the loop — a Store install and a Biome installation row share one stable identifier.

`POST /installs/:id/uninstall` records the reverse transition; cleanup of the biome installation itself is the biome host's responsibility, again event-driven.

---

## Submission and review

Submission writes the manifest + bundle + permission digest into a `StoreListingVersion` row in lifecycle `store-submitted`. While in that lifecycle the version runs only in the `store-review` execution environment — no production org data, no production credentials, no network beyond what the environment allows.

The reviewer surface (`POST /submissions/:version/approve` | `/reject` | `/comment`) writes `ReviewLog` rows that are the audit trail for the decision. Comments are not free-form admin notes — every comment is structurally addressable via `GET /submissions/:version/review-log` for the publisher to read and respond to.

---

## Pricing

The data model carries a `pricingPolicy` field on `StoreListing`. **Pricing is deferred and not active in this phase.** The column exists so future activation does not require a schema migration; today every install behaves as if the policy is "free". When activation lands, Xema will handle billing transparently — biome authors and installers do not configure billing endpoints directly.

---

## Cross-references with biome lifecycle

The Store does not own the biome lifecycle — `biome-host-api` does. The Store consumes [biome.lifecycle](./biomes.md#the-biome-lifecycle) transitions through capability calls. Approval of a submitted version is also the `biome:approve-in-store@1` transition; install is also the runtime brokering described under [Biomes — Install Stage 2](./biomes.md#install--stage-2-runtime-brokering). Treat the Store and the biome host as two services agreeing on one lifecycle through capabilities.

---

## Related concepts

- [store](./concepts/store.md) — concept summary
- [biome](./concepts/biome.md), [lifecycle](./concepts/lifecycle.md) — the state machine the Store mediates
- [capability](./concepts/capability.md) — every Store action resolves to one
- [execution-environment](./concepts/execution-environment.md) — `store-review` is where submissions run
- [lockfile](./concepts/lockfile.md), [versioning](./versioning.md) — what installs pin
- [SDK / Publishing](./sdk/publishing.md) — the publisher-side flow

---

**Previous**: [← Shell](./shell.md)
**Next**: [Versioning →](./versioning.md)
