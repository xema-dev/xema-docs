# Service Registry

The **Service Registry** is how every part of Xema OS discovers every other part. Platform services, biome-shipped backends, runners, and the CLI all register themselves at boot and resolve their dependencies through the same uniform surface. There is no `*_API_URL` environment variable, no hand-rolled service-discovery shim, no static topology baked into deploy manifests.

The registry is part of the kernel control plane and is consumed by every service via a typed NestJS SDK.

---

## What the registry stores

For each running service or runner, the registry holds three things:

1. **`ServiceDescriptor`** — name, semver, endpoints, exposed capabilities, required services, health endpoint, region, labels.
2. **Lease** — a short-lived TTL the service renews. If renewal stops, the entry is reaped.
3. **Status** — current health (`starting` / `ready` / `draining` / `unhealthy`).

The descriptor lives in the kernel's state store under a closed key grammar:

```
/xema/services/<name>/<instanceId>/spec
/xema/services/<name>/<instanceId>/lease
/xema/services/<name>/<instanceId>/status
```

The state store has two adapters — SQLite (dev + single-instance) and etcd (cluster). Every service speaks the same `ServiceRegistry` interface; the adapter is transparent.

---

## Registration at boot

Every NestJS service in Xema uses `ServiceRegistryModule.forRootAsync()` from `@xemahq/service-registry-nest`. At boot:

```ts
import { ServiceRegistryModule } from '@xemahq/service-registry-nest';

@Module({
  imports: [
    ServiceRegistryModule.forRootAsync({
      useFactory: () => ({
        serviceName: 'memory-api',
        endpoints: [{ kind: 'http', baseUrl: process.env.XEMA_PUBLIC_BASE_URL }],
        requiresServices: ['object-registry-api', 'authorization-api'],
      }),
    }),
  ],
})
export class AppModule {}
```

At startup the module:

1. Builds a `ServiceDescriptor` from the service's `package.json` + the factory result.
2. Calls `serviceRegistry.register()` — writes the descriptor + lease.
3. Starts a renewal timer at 1/3 of the lease TTL.
4. Subscribes to watches for every `requiresServices` entry.
5. Switches the service status from `starting` to `ready` once dependencies are present.

At shutdown the module flips status to `draining`, lets in-flight requests finish, then deletes its own entries. A crashed instance's lease expires naturally and the reaper deletes it.

---

## Resolving a dependency — `@InjectService(name)`

Consumers never construct URLs by hand. The registry SDK provides a typed decorator:

```ts
import { Injectable } from '@nestjs/common';
import { InjectService } from '@xemahq/service-registry-nest';
import type { LlmRegistryClient } from '@xemahq/llm-registry-client';

@Injectable()
export class CompositionService {
  constructor(
    @InjectService('llm-registry-api')
    private readonly llmRegistry: LlmRegistryClient,
  ) {}

  async resolveModel(input: ResolveModelInput) {
    return this.llmRegistry.modelMatrix.resolve(input);
  }
}
```

`@InjectService` returns a generated Orval client whose `baseUrl` is **live** — the underlying HTTP transport reads the resolved URL from the registry on every call, with a short in-process cache. When the target service scales out, restarts, or moves, callers do not reconnect; the next request resolves to the new instance.

Auth headers are attached automatically. The registry SDK ships a default `ServiceAuthInterceptor` that:

- Mints a service-account token at first use.
- Refreshes at ~80% of the token's lifetime with jitter.
- Attaches `Authorization: Bearer <token>` to every outbound request.

No service speaks plain HTTP to another service; every call carries an identity-provider-issued token verified by the receiver's auth guard.

---

## Discovery for non-NestJS callers

Services that are not NestJS apps (the `xema` CLI, runners, scripts) use the lower-level `ServiceRegistryClient` directly:

```ts
import { ServiceRegistryClient } from '@xemahq/service-registry-contracts';

const registry = ServiceRegistryClient.fromKernelState({
  adapter: process.env.XEMA_KERNEL_STATE === 'etcd' ? 'etcd' : 'sqlite',
});

const memoryApi = await registry.resolve('memory-api');
console.log(memoryApi.endpoints[0].baseUrl);
```

The same descriptor shape, the same auth attachment rules — no app-specific glue.

---

## Cluster, single-instance, dev — one API

The registry API is identical across all three deployment profiles:

| Profile | State adapter | Failure semantics |
|---|---|---|
| `dev` (single binary) | SQLite, in-process pub-sub for watches | A crashed registrar is reaped within one TTL |
| `single-instance` (one VM) | SQLite on a local disk | Same as dev |
| `cluster` | etcd with TTL leases and stream watches | Cross-replica consistency guaranteed by etcd |

A biome author can `xema dev`, register their backend service, and resolve from another biome on their laptop — then push the same biome to a cluster and have it work without changing a line.

---

## Why this exists

Before the registry, every service carried its own coupling:

- A `LLM_REGISTRY_API_URL` env var per consumer.
- A static `*-client-module.ts` factory file per consumer.
- A docker-compose / Helm values entry per consumer.
- A per-service "seeder" that hot-loaded peers at boot.

Adding a service meant editing dozens of consumers. Renaming a service meant a coordinated PR across the monorepo. The registry collapses all of that into **two things**: register once at boot, inject by name.

---

## Inspecting the registry

| Command | What it shows |
|---|---|
| `xema services list` | Every registered service, with its current status and lease |
| `xema services describe <name>` | Full descriptor including capabilities and labels |
| `xema doctor services` | Health check across every required dependency edge |

The Object Browser also exposes the registry: each service appears as a typed `XemaObject` of kind `service-instance` anchored to `xema://system`.

---

## Related concepts

- [Runners](./runners.md) — runners register through the same surface.
- [Capabilities](./capabilities.md) — a capability is hosted by one or more registered services.
- [Developer annotations](./developer-annotations.md) — `@XemaResource` + `@XemaRoute` produce the manifest that registration consumes.
- [Apps](./apps.md) — apps resolve their backing biomes through the registry.

---

**Previous**: [← Runners](./runners.md)
**Next**: [MCP and Capabilities →](./mcp-and-capabilities.md)
