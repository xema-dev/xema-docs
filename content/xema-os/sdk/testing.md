# SDK — Testing

A biome is testable at four levels, from cheapest to most expensive:

1. **Manifest validation** — parse `xema-biome.json` against the kernel schema.
2. **Contribution unit tests** — each contribution (agent, workflow, handler) is testable in isolation.
3. **Capability-stub tests** — mock the gateway, assert that the biome calls the right capabilities with the right inputs.
4. **End-to-end** — install into a sandbox, exercise the biome through real capability calls.

This page covers the first three. End-to-end tests share infrastructure with the platform's own dev test-suite at `test-suite/`.

---

## 1. Manifest validation

The kernel schema (`BiomeManifestSchema` in `@xemahq/biome-contracts`) is the single source of truth. Validate at unit-test time with the same Zod parser the host uses at install:

```ts
// tests/manifest.spec.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { BiomeManifestSchema } from '@xemahq/biome-contracts';

describe('xema-biome.json', () => {
  it('parses against the kernel schema', () => {
    const raw = JSON.parse(readFileSync('./xema-biome.json', 'utf8'));
    expect(() => BiomeManifestSchema.parse(raw)).not.toThrow();
  });
});
```

The parser refuses unknown closed-set values fail-fast. Run this test in your biome's CI before any other step — a manifest that fails parse cannot install.

---

## 2. Contribution unit tests

Each contribution is a pure(-ish) module: an agent definition is a YAML document, a workflow definition is YAML, a handler is a TS function. Test them the way you would test any other unit.

**Agent definitions** — parse with `@xemahq/agent-contracts` and assert structural invariants:

```ts
import { AgentDefinitionSchema } from '@xemahq/agent-contracts';
import yaml from 'js-yaml';
import { readFileSync } from 'node:fs';

it('greeter is a well-formed agent', () => {
  const def = yaml.load(readFileSync('./agents/greeter.agent.yaml', 'utf8'));
  const parsed = AgentDefinitionSchema.parse(def);
  expect(parsed.metadata.slug).toBe('greeter');
});
```

**Workflow definitions** — parse with the DSL compiler from `@xemahq/workflow-dsl`. The compiler runs the same closed-set checks the platform runs at install time.

**Event handlers** — import the handler module, build a typed event envelope by hand, pass a mock context, assert on the calls the handler makes (see below).

---

## 3. Capability-stub tests

Biome runtime code never calls platform services directly — it calls capabilities through `ctx.callCapability(...)`. To test what your handler does on a given event, replace `callCapability` with a spy:

```ts
import { describe, it, expect, vi } from 'vitest';
import onRunCompleted from '../dist/handlers/on-run-completed.js';

describe('on-run-completed', () => {
  it('posts a chat message when the run succeeds', async () => {
    const callCapability = vi.fn().mockResolvedValue({ ok: true });

    await onRunCompleted(
      {
        type: 'workflow.run.completed.v1',
        source: 'workflow-engine-api',
        id: 'evt-1',
        time: '2026-05-26T12:00:00Z',
        subject: 'xema://orgs/acme/projects/main/workflow-run/r-1',
        orgid: 'org_acme',
        projectid: 'proj_main',
        data: { workflowRunId: 'r-1', outcome: 'success' },
      },
      { callCapability, log: console, installationId: 'inst-1' } as any,
    );

    expect(callCapability).toHaveBeenCalledTimes(1);
    expect(callCapability).toHaveBeenCalledWith(
      'connector:chat.send-message@1',
      expect.objectContaining({ channel: 'team-engineering' }),
    );
  });

  it('is idempotent on retries', async () => {
    const callCapability = vi.fn().mockResolvedValue({ ok: true });
    const event = makeEvent({ id: 'evt-1' }); // same id

    await onRunCompleted(event, { callCapability } as any);
    await onRunCompleted(event, { callCapability } as any);

    // Handler must dedupe internally on event.id
    expect(callCapability).toHaveBeenCalledTimes(1);
  });
});
```

The pattern generalises:

- **What you assert** — which capability refs the biome calls, with which inputs, in which order, and that it does *not* call refs outside its declared `requiresCapabilities[]`.
- **What you do not assert** — what the platform does after the capability call. That is the platform's contract, not the biome's.

---

## Asserting the manifest matches the runtime

A common bug is a handler that calls a capability the manifest does not declare. Catch it in CI:

```ts
import { readFileSync } from 'node:fs';
import { BiomeManifestSchema } from '@xemahq/biome-contracts';

it('every capability the handler calls is in requiresCapabilities[]', () => {
  const manifest = BiomeManifestSchema.parse(
    JSON.parse(readFileSync('./xema-biome.json', 'utf8')),
  );
  const declared = new Set(manifest.xema.requiresCapabilities ?? []);

  // calls is the set asserted in your handler unit tests
  const calls = new Set([
    'connector:chat.send-message@1',
    'biome-storage:collection.write@1',
  ]);

  for (const ref of calls) {
    expect(declared.has(ref)).toBe(true);
  }
});
```

Running this as a unit test means a misdeclared manifest fails before publish — the alternative is a runtime denial at install time.

---

## Storage tests

A biome with declared collections can validate its schemas against `@xemahq/biome-storage-sdk`'s `CollectionSchema` parser:

```ts
import { CollectionSchema } from '@xemahq/biome-storage-sdk';
import { readFileSync } from 'node:fs';

it('incidents schema parses', () => {
  const schema = JSON.parse(readFileSync('./storage/incidents.schema.json', 'utf8'));
  expect(() => CollectionSchema.parse(schema)).not.toThrow();
});
```

The parser enforces the closed field-type set, the `enum` requirement of a non-empty `values` array, and that every index references a declared field.

---

## Lifecycle hook tests

Test hooks the same way as event handlers — pass a mock `BiomeLifecycleHookContext`, assert on capability calls:

```ts
import onInstall from '../dist/hooks/on-install.js';

it('seeds the default incident row', async () => {
  const callCapability = vi.fn().mockResolvedValue({});

  await onInstall({
    installationId: 'inst-1',
    orgId: 'org_acme',
    projectId: 'proj_main',
    previousVersion: null,
    currentVersion: '1.0.0',
    environment: 'environment:org',
    callCapability,
  } as any);

  expect(callCapability).toHaveBeenCalledWith(
    'biome-storage:collection.write@1',
    expect.objectContaining({ collection: 'incidents' }),
  );
});
```

Run the same call twice to assert idempotency — the host may retry a failed transition, and the hook must not double-write.

---

## End-to-end against a sandbox

The cheapest path to a real end-to-end run is to install the biome into a sandbox environment via the existing platform install flow (today: `POST /biomes/install`; Phase 5+: `xema biome install ./your-biome --environment sandbox`). Sandbox runs have no production credentials and no production data; the gateway denies any call that asks for them.

The platform's own test-suite (`test-suite/`) gives a working local stack. See the test-suite README for the docker-compose stand-up.

---

## Related pages

- [Manifest reference](./manifest.md) — what to validate
- [Lifecycle Hooks](./lifecycle-hooks.md) — what to stub-test
- [Events I subscribe](./events-i-subscribe.md) — the event envelope shape
- [Storage](./storage.md) — the collection-schema parser
- [Publishing](./publishing.md) — why catching errors here matters

---

**Previous**: [← Events I subscribe](./events-i-subscribe.md)
