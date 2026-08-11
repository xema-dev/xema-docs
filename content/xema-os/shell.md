# Shell

The **Xema Shell** is the unified, deterministic command surface of the OS. Humans (web terminal), agents (via `xema-shell:run@1`), and CI tools (HTTP) issue the same verb-noun commands through the same dispatcher. Every command is a thin wrapper over one capability; nothing in the Shell short-circuits the gateway.

The Shell is not bash. It has no string-eval, no pipes, no fork. `argv` is structural; the parser tokenises strings into argv arrays using a fixed, side-effect-free grammar. Three surfaces share one dispatcher.

---

## The three surfaces

| Surface | Consumer | Transport | Output mode |
| --- | --- | --- | --- |
| `xterm.js` terminal at `/shell` in the host UI | Humans | WebSocket → `xema-shell-api` `/shell/ws` | Human-formatted |
| `POST /shell/run` on `xema-shell-api` | CI, integrations, scripts | HTTP | `--json` |
| `xema-shell:run@1` capability | Agents | Capability Gateway | `--json` forced |

The agent surface is not a back door — it is the gateway invoking the dispatcher under the calling agent's subject, environment, and grants. If a human cannot run a command, the agent cannot either.

---

## Structured `argv` (no shell eval)

The wire shape of a Shell run is the same on every surface:

```ts
interface XemaShellRunInput {
  argv: string[];          // structured tokens — never a raw string on the wire
  outputMode: 'json' | 'human';
  cwd?: string;            // XVFS path; defaults to subject's home
  stdin?: unknown;         // structured input for commands that take it
  environment?: string;           // explicit environment override (subject must hold a grant)
}

interface XemaShellRunOutput {
  exitCode: number;
  data: unknown;           // shaped per the command's outputSchema
  auditId: string;
  denial?: unknown;        // structured denial for non-zero exit codes
  diagnostics?: unknown;
}
```

Hard rules:

- `argv` is an array, not a string. The Shell never evaluates a raw command string from a non-human surface.
- The capability runs under the calling subject + environment. The gateway resolves grants exactly as for any other call.
- Output is always JSON shaped per the command's `outputSchema` on the agent and CI surfaces — agents reason over typed data, not human prose.

The human terminal accepts free text; `command-parser.ts` tokenises it into `argv` using the same deterministic grammar the WebSocket gateway and HTTP controller use.

---

## The WebSocket transport — `/shell/ws`

The web terminal connects to `wss://xema-shell-api.xema.dev/shell/ws`. Auth is the same delegated-session JWT the HTTP `POST /shell/run` accepts.

**Inbound frames (client → server):**

| Type | Shape |
|---|---|
| `run` | `{ type: 'run', argv: string[], cwd?: string, environment?: string, requestId?: string }` |

**Outbound frames (server → client):**

| Type | Shape |
|---|---|
| `stdout` | `{ type: 'stdout', requestId, data: unknown }` |
| `stderr` | `{ type: 'stderr', requestId, message, code? }` |
| `exit` | `{ type: 'exit', requestId, exitCode, auditId, denial?, diagnostics? }` |
| `error` | `{ type: 'error', message, code: ShellWsErrorCode }` (transport-level) |

`ShellWsErrorCode` is a closed enum: `SHELL_WS_UNAUTHENTICATED`, `SHELL_WS_INVALID_FRAME`, `SHELL_WS_UNKNOWN_TYPE`, `SHELL_WS_INVALID_ARGV`, `SHELL_WS_INTERNAL_ERROR`.

`argv` is required on every inbound frame — the server never accepts raw command strings. The xterm.js client tokenises on its side using `command-parser.ts`.

The WS transport is gated by `XEMA_SHELL_WS_ENABLED`. When disabled, the gateway refuses to bind the path; the HTTP `POST /shell/run` surface remains live.

---

## The terminal route — `/shell`

The host shell exposes an xterm.js-backed terminal at `/shell` in `xema-host-web`. The page wires xterm.js (with `@xterm/addon-fit`, `@xterm/addon-web-links`, `@xterm/addon-search`) to the `/shell/ws` gateway through the `useXemaShellSession()` hook.

The page is also available embedded at `/embedded/shell` for external-subject contexts where the host shell is replaced by an app's branded chrome. The embedded variant carries the delegated session JWT in the URL token.

---

## Built-in commands

All built-in. None are biome-contributed. Each is a thin capability:

| Command | Capability | Purpose |
| --- | --- | --- |
| `xema help` / `xema help <cmd>` | `xema-shell:help@1` | Command discovery + per-command metadata |
| `xema concepts` | `xema-shell:concepts.list@1` | List all `Concept` objects |
| `xema concept <slug>` | `xema-shell:concept.read@1` | Resolve a single concept |
| `xema explain <path-or-ref>` | `xema-shell:explain@1` | Human + agent-friendly description of any object |
| `xema inspect <path-or-ref>` | `xema-shell:inspect@1` | Structured dump (manifest, grants, lifecycle, versions) |
| `xema ls <xvfs-path>` | `xema-shell:ls@1` | List children of an XVFS path |
| `xema cat <xvfs-path>` | `xema-shell:cat@1` | Read object payload |
| `xema run <ref>` | `xema-shell:run-object@1` | Invoke a workflow / composition |
| `xema grant <subject> <capability> ...` | `xema-shell:grant@1` | Issue a capability grant |
| `xema capabilities explain <ref>` | `xema-shell:capability.explain@1` | Required zones, default grants, audit policy |
| `xema environment explain <env>` | `xema-shell:environment.explain@1` | Environment semantics + allowed capabilities |
| `xema biome install <ref>` | `biome:install@1` | Install a biome into a environment |
| `xema biome publish <path>` | `biome:submit-to-store@1` | Submit a biome to the [Store](./store.md) |
| `xema memory recall <query>` | `memory:recall@1` | Search subject-scoped memory |
| `xema why-denied <auditId>` | `xema-shell:audit.read@1` | Structured "why was this call denied" |
| `xema doctor [target]` | `xema-shell:doctor@1` | Static + runtime health check |

Every command supports `--json`. The agent-facing surface (`xema-shell:run@1`) forces `--json` regardless of flag.

---

## `safeForAgents` and the Shell-vs-capability rule

Not every command should be reachable by every agent. `safeForAgents` is a per-command flag in the `ShellCommandDescriptor`, enforced by `xema-capability-router`:

- `safeForAgents=true` — discovery, inspection, help, concept lookup, `why-denied`, `doctor`, read-only `ls`/`cat`/`inspect`.
- `safeForAgents=false` — destructive admin actions, lifecycle transitions like `biome publish`, anything that mutates a Store listing, anything that grants capabilities.

Agents needing a `safeForAgents=false` action still go through the gateway with the underlying capability directly. The Shell is the discovery surface for them, not a bulk-action surface.

---

## The sandbox terminal — for biome build containers only

A **separate** terminal lives at `xema-shell-api`'s `/sandbox/terminal/:installationId` (Wave 2). This terminal is **not** the Xema Shell — it is a `node-pty`-backed real Linux PTY exposed to Biome Studio's "open a real terminal in my biome's build container" surface.

Hard constraints:

- The PTY runs in the `sandbox` execution environment only. Production zones are refused at the gateway.
- The PTY has no org credentials and no production data access.
- The PTY is the **only** place in Xema where a literal shell exists. Every other "terminal" surface is the structured Xema Shell.
- Authorization: a sandbox-environment grant for `biome:sandbox.terminal@1` is required; the grant is scoped to the calling subject's own draft biome installation.

The split is deliberate: the Xema Shell stays auditable, replayable, and parseable; sandbox terminals stay isolated, ephemeral, and bounded to biome authoring.

---

## Discovery vs runtime work

Agents that loop on `xema ls` instead of subscribing to the relevant Object Registry event are a performance anti-pattern. `xema doctor` flags it. The Shell is for **discovery, inspection, lifecycle transitions, and one-shot calls**; high-frequency runtime work goes through the underlying capability directly.

---

## Related concepts

- [xema-shell](./concepts/xema-shell.md) — concept summary
- [capability](./concepts/capability.md) — every command resolves to one
- [execution-environment](./concepts/execution-environment.md) — every call carries one
- [xvfs](./concepts/xvfs.md) — the path namespace `ls` and `cat` walk
- [biomes](./biomes.md) — `biome install`, `biome publish` lifecycle calls

---

**Previous**: [← Biomes](./biomes.md)
**Next**: [Store →](./store.md)
