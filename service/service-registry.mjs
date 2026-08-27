// Self-registration into the Xema KernelState service registry.
//
// WHY THIS EXISTS
// ---------------
// Every first-party Xema service announces itself into etcd at boot through
// `@xemahq/xema-service-nest`, and peers resolve it with
// `resolveHttpUrl(registry, '<name>')`. docs-api could not: it is a
// zero-dependency Node server, and the SDK is a NestJS module.
//
// So docs-api was carried on the kernel's "external services" floor — the list
// of services whose code we do NOT control, registered on their behalf by
// xema-kernel-server. That was always a category error: docs-api is ours, in our
// org, under our licence. It sat on a list whose stated rationale is "we cannot
// change their code", and the cost was real — when nobody set the kernel's
// DOCS_API_URL, docs-api was silently never registered and every new
// xema-shell-api image crashlooped at boot while the Deployment read healthy.
//
// This module removes docs-api from that category WITHOUT giving up the property
// that put it there: it uses only Node built-ins (`fetch`, `crypto`), so
// `package.json` still has an empty `dependencies`. etcd's v3 gRPC-gateway
// speaks plain JSON over HTTP, which is all this needs.
//
// CONTRACT — mirrored from the SDK, not invented
// ----------------------------------------------
// Key    : /xema/services/<name>/<instanceId>/spec
// Value  : { descriptor, leaseId, registeredAt, leaseExpiresAt }   <- NOT a bare
//          descriptor; consumers read the wrapper.
// Lease  : TTL 30s, renewed every 15s. Three consecutive renew failures exit the
//          process so the orchestrator restarts it and it re-registers cleanly,
//          rather than serving while peers resolve a lapsing endpoint.
//
// The self URL follows `buildSelfHttpEndpointUrl` exactly: SERVICE_PUBLIC_URL if
// set, else POD_NAMESPACE composes the cluster DNS name, else fail fast under the
// cluster profile — advertising `localhost` from a pod is unreachable to every
// peer, and that is far worse caught late.

import { randomUUID } from 'node:crypto';

const SERVICE_NAME = 'docs-api';
const LEASE_TTL_SECONDS = 30;
const RENEW_INTERVAL_MS = 15_000;
const MAX_CONSECUTIVE_RENEW_FAILURES = 3;
const KEY_PREFIX = '/xema/services';

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

function env(key) {
  const v = process.env[key]?.trim();
  return v === undefined || v === '' ? undefined : v;
}

/**
 * Cluster-internal URL other services will dial. Mirrors the SDK's
 * `buildSelfHttpEndpointUrl` so docs-api advertises itself the same way every
 * first-party service does.
 */
export function buildSelfUrl() {
  const explicit = env('SERVICE_PUBLIC_URL');
  if (explicit !== undefined) return explicit.replace(/\/+$/, '');

  const port = env('PORT') ?? '3000';
  const namespace = env('POD_NAMESPACE');
  if (namespace !== undefined) {
    return `http://${SERVICE_NAME}.${namespace}.svc.cluster.local:${port}`;
  }
  if (env('XEMA_KERNEL_STATE_PROFILE') === 'cluster') {
    throw new Error(
      `[service-registry] cannot determine a reachable self URL for ` +
        `"${SERVICE_NAME}" under the cluster profile — set SERVICE_PUBLIC_URL, ` +
        `or inject POD_NAMESPACE via the Kubernetes downward API. Refusing to ` +
        `advertise "http://localhost:${port}", which no peer can reach.`,
    );
  }
  return `http://localhost:${port}`;
}

class EtcdClient {
  #origins;
  #username;
  #password;
  #token;

  constructor(endpoints, username, password) {
    // `host:port` (as the platform spells them) or a full URL both work.
    this.#origins = endpoints
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0)
      .map((e) => (/^https?:\/\//.test(e) ? e.replace(/\/+$/, '') : `http://${e}`));
    if (this.#origins.length === 0) {
      throw new Error('[service-registry] XEMA_ETCD_ENDPOINTS is empty');
    }
    this.#username = username;
    this.#password = password;
  }

  async #post(path, body, { retryAuth = true } = {}) {
    let lastError;
    // Client-side round-robin: any endpoint can serve, so a single dead pod
    // must not fail the call.
    for (const origin of this.#origins) {
      try {
        const headers = { 'content-type': 'application/json' };
        if (this.#token !== undefined) headers.authorization = this.#token;
        const res = await fetch(`${origin}${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });
        if (res.status === 401 && retryAuth && this.#username !== undefined) {
          this.#token = undefined;
          await this.authenticate();
          return this.#post(path, body, { retryAuth: false });
        }
        if (!res.ok) {
          lastError = new Error(
            `etcd ${path} -> HTTP ${res.status} ${(await res.text()).slice(0, 200)}`,
          );
          continue;
        }
        return await res.json();
      } catch (cause) {
        lastError = cause;
      }
    }
    throw new Error(
      `[service-registry] every etcd endpoint failed for ${path}: ${lastError?.message ?? lastError}`,
    );
  }

  async authenticate() {
    if (this.#username === undefined) return;
    const out = await this.#post(
      '/v3/auth/authenticate',
      { name: this.#username, password: this.#password ?? '' },
      { retryAuth: false },
    );
    if (typeof out?.token !== 'string') {
      throw new Error('[service-registry] etcd authenticate returned no token');
    }
    this.#token = out.token;
  }

  async grantLease(ttlSeconds) {
    const out = await this.#post('/v3/lease/grant', { TTL: String(ttlSeconds) });
    const id = out?.ID;
    if (typeof id !== 'string' || id === '0') {
      throw new Error(`[service-registry] etcd refused a lease: ${JSON.stringify(out)}`);
    }
    return id;
  }

  async put(key, value, leaseId) {
    await this.#post('/v3/kv/put', { key: b64(key), value: b64(value), lease: leaseId });
  }

  async keepAlive(leaseId) {
    const out = await this.#post('/v3/lease/keepalive', { ID: leaseId });
    // A lapsed lease comes back with TTL 0 — that is a real failure, not a
    // successful renewal, and must not be treated as one.
    const ttl = out?.result?.TTL ?? out?.TTL;
    if (ttl === undefined || Number(ttl) <= 0) {
      throw new Error(`[service-registry] lease ${leaseId} did not renew (TTL ${ttl})`);
    }
  }

  async delete(key) {
    await this.#post('/v3/kv/deleterange', { key: b64(key) });
  }
}

/**
 * Register this instance and keep its lease alive.
 *
 * Returns `null` when registration is not configured (`XEMA_ETCD_ENDPOINTS`
 * unset) — the standalone/docs-site case. That is reported on stdout, never
 * silent: a service that believes it registered and did not is precisely the
 * failure this module exists to remove.
 *
 * When etcd IS configured, every failure is fatal. There is no degraded mode:
 * an unregistered docs-api in a cluster means every consumer that resolves it
 * crashloops, and failing here names the cause.
 */
export async function registerSelf({ semver }) {
  const endpoints = env('XEMA_ETCD_ENDPOINTS');
  if (endpoints === undefined) {
    console.log(
      `[service-registry] XEMA_ETCD_ENDPOINTS is not set — running standalone, ` +
        `not registering "${SERVICE_NAME}". Peers resolving it will not find it.`,
    );
    return null;
  }

  const url = buildSelfUrl();
  const instanceId = `${SERVICE_NAME}-${randomUUID()}`;
  const key = `${KEY_PREFIX}/${SERVICE_NAME}/${instanceId}/spec`;

  const client = new EtcdClient(
    endpoints,
    env('XEMA_ETCD_USERNAME'),
    env('XEMA_ETCD_PASSWORD'),
  );
  await client.authenticate();

  const write = async () => {
    const leaseId = await client.grantLease(LEASE_TTL_SECONDS);
    const now = new Date();
    const descriptor = {
      name: SERVICE_NAME,
      semver,
      instanceId,
      endpoints: [{ protocol: 'http', url, auth: 'none' }],
      exposesCapabilities: [],
      requiresServices: [],
      // No `healthEndpoint`. It is still DECLARED on `ServiceDescriptor` in
      // @xemahq/kernel-contracts (optional), but nothing in the fleet reads it
      // and this line was its only writer anywhere — it wrote a URL nothing
      // ever fetched. Re-measured 2026-08-31 across all 28 repositories at
      // `origin/main`: exactly two occurrences, the declaration and this write.
      // Liveness is the KernelState lease TTL, which is the contract's sole
      // proof-of-liveness, and the lease below is what provides it. This file
      // builds the descriptor by hand (it ships no Xema SDK), so nothing would
      // have caught the orphan write on its own.
    };
    await client.put(
      key,
      JSON.stringify({
        descriptor,
        leaseId,
        registeredAt: now.toISOString(),
        leaseExpiresAt: new Date(now.getTime() + LEASE_TTL_SECONDS * 1000).toISOString(),
      }),
      leaseId,
    );
    return leaseId;
  };

  let leaseId = await write();
  console.log(`[service-registry] registered "${SERVICE_NAME}" -> ${url} (lease ${leaseId})`);

  let failures = 0;
  const timer = setInterval(async () => {
    try {
      await client.keepAlive(leaseId);
      failures = 0;
    } catch (error) {
      failures += 1;
      console.error(
        `[service-registry] renew ${failures}/${MAX_CONSECUTIVE_RENEW_FAILURES} failed: ${error.message}`,
      );
      if (failures >= MAX_CONSECUTIVE_RENEW_FAILURES) {
        clearInterval(timer);
        console.error(
          `[service-registry] lease lost for "${SERVICE_NAME}"; exiting so the ` +
            `orchestrator restarts us and we re-register cleanly.`,
        );
        process.exit(1);
      }
    }
  }, RENEW_INTERVAL_MS);
  timer.unref?.();

  return {
    instanceId,
    url,
    async deregister() {
      clearInterval(timer);
      try {
        await client.delete(key);
      } catch (error) {
        // Best effort ONLY here: the lease expires within TTL regardless, so a
        // failed explicit delete costs at most one TTL of staleness. Everything
        // else in this module is fail-fast.
        console.error(`[service-registry] deregister failed: ${error.message}`);
      }
    },
  };
}
