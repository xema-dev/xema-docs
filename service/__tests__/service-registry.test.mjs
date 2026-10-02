// Runs the REAL registerSelf against a stubbed etcd JSON gateway and asserts
// on the key it actually PUTs — not on a helper — so a regression that
// bypasses the keyspace at the call site fails here.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerSelf, resolveKeyspacePrefix } from '../service-registry.mjs';

const ENV_KEYS = [
  'XEMA_ETCD_ENDPOINTS', 'XEMA_ETCD_USERNAME', 'XEMA_ETCD_PASSWORD',
  'XEMA_KERNEL_STATE_KEYSPACE_PREFIX', 'SERVICE_PUBLIC_URL', 'POD_NAMESPACE',
];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const realFetch = globalThis.fetch;
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
  globalThis.fetch = realFetch;
});

function stubEtcd() {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const path = new URL(url).pathname;
    const body = JSON.parse(init.body);
    calls.push({ path, body });
    const out = path === '/v3/lease/grant' ? { ID: '42' }
      : path === '/v3/lease/keepalive' ? { result: { TTL: '30' } }
      : {};
    return new Response(JSON.stringify(out), { status: 200 });
  };
  return calls;
}
const decode = (b) => Buffer.from(b, 'base64').toString('utf8');

async function putKey(prefix) {
  process.env.XEMA_ETCD_ENDPOINTS = 'etcd:2379';
  process.env.SERVICE_PUBLIC_URL = 'http://docs-api.test:3000';
  if (prefix === undefined) delete process.env.XEMA_KERNEL_STATE_KEYSPACE_PREFIX;
  else process.env.XEMA_KERNEL_STATE_KEYSPACE_PREFIX = prefix;
  const calls = stubEtcd();
  const reg = await registerSelf({ semver: '0.0.0-test' });
  await reg.deregister();
  const puts = calls.filter((c) => c.path === '/v3/kv/put').map((c) => decode(c.body.key));
  const dels = calls.filter((c) => c.path === '/v3/kv/deleterange').map((c) => decode(c.body.key));
  assert.equal(puts.length, 1);
  assert.deepEqual(dels, puts, 'deregister deletes exactly the key it wrote');
  return puts[0];
}

test('a declared keyspace prefixes the registered key', async () => {
  const key = await putKey('/deployments/owl-xema-prod');
  assert.match(key, /^\/deployments\/owl-xema-prod\/xema\/services\/docs-api\/docs-api-[0-9a-f-]+\/spec$/);
});

test('no keyspace keeps the root key grammar (single-deployment etcd)', async () => {
  const key = await putKey(undefined);
  assert.match(key, /^\/xema\/services\/docs-api\/docs-api-[0-9a-f-]+\/spec$/);
});

test('a malformed keyspace is REFUSED, never repaired', () => {
  for (const bad of ['deployments/x', '/deployments/x/', '/a b', '/']) {
    process.env.XEMA_KERNEL_STATE_KEYSPACE_PREFIX = bad;
    assert.throws(() => resolveKeyspacePrefix(), /is not a keyspace prefix/, bad);
  }
  process.env.XEMA_KERNEL_STATE_KEYSPACE_PREFIX = '   ';
  assert.equal(resolveKeyspacePrefix(), '', 'blank reads as absent, like the SDK');
});
