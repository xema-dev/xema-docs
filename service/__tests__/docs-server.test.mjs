// Boots the real service/server.mjs and reads one document over HTTP, so a
// server that does not even start (syntax error, bad import, bad path handling)
// fails verification here instead of crashlooping in a cluster. Node builtins only.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function waitForListening(child, output) {
  const deadline = Date.now() + 15000;
  while (!output.text.includes('listening on')) {
    if (child.exitCode !== null) {
      throw new Error(`server.mjs exited ${child.exitCode} before listening:\n${output.text}`);
    }
    if (Date.now() > deadline) throw new Error(`server.mjs never listened:\n${output.text}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

test('server.mjs starts and serves a known document with 200 and a body', async () => {
  const port = await freePort();
  const output = { text: '' };
  const child = spawn(process.execPath, [join(ROOT, 'service', 'server.mjs')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DOCS_SOURCE_DIR: join(ROOT, 'content') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => { output.text += d; });
  child.stderr.on('data', (d) => { output.text += d; });
  try {
    await waitForListening(child, output);
    // content/index.md
    const response = await fetch(`http://127.0.0.1:${port}/content?path=index`);
    const body = await response.text();
    assert.equal(response.status, 200, body);
    assert.ok(body.length > 0, 'the document body is empty');
  } finally {
    child.kill('SIGTERM');
  }
});
