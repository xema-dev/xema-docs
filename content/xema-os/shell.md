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

Command names carry no `xema` prefix — that prefix belongs to the [CLI](./cli.md), which is a different surface.

| Command | Capability | `safeForAgents` | Purpose |
| --- | --- | --- | --- |
| `help` / `help <cmd>` | `xema-shell:help@1` | yes | Command discovery + per-command metadata |
| `concepts` | `xema-shell:concepts.list@1` | yes | List every `Concept` object |
| `concept <slug>` | `xema-shell:concept.read@1` | yes | Resolve a single concept |
| `explain <path-or-ref>` | `xema-shell:explain@1` | yes | Human-friendly description of any object |
| `inspect <path-or-ref>` | `xema-shell:inspect@1` | yes | Structured dump of an object |
| `ls <xvfs-scope>` | `xema-shell:ls@1` | yes | List objects under an XVFS scope prefix |
| `cat <ref>` | `xema-shell:cat@1` | yes | Resolve a ref and return the object payload |
| `capabilities explain <ref>` | `xema-shell:capability.explain@1` | yes | Parse a capability ref against the kernel grammar |
| `environments explain <env>` | `xema-shell:environment.explain@1` | yes | Fetch a built-in execution-environment row |
| `why-denied <auditId>` | `xema-shell:audit.read@1` | yes | Explain a capability-router denial by audit id |
| `doctor` | `xema-shell:doctor@1` | yes | Kernel health checks against the current platform |
| `memory recall <query>` | `xema-shell:memory.recall@1` | yes | Recall memory entries for a subject |
| `db list` | `xema-shell:db.list@1` | yes | List org-managed databases |
| `db describe` | `xema-shell:db.describe@1` | yes | Schema tree of a database (schemas + tables) |
| `db query` | `xema-shell:db.query@1` | yes | Run a read-only SQL query through the database explorer |
| `db migrate` | `xema-shell:db.migrate@1` | **no** | Trigger a migrations run for a database |
| `run <ref>` | `xema-shell:run-object@1` | **no** | Invoke the capability bound to an XVFS object |
| `biome install <ref>` | `xema-shell:biome.install@1` | **no** | Install a biome into the current environment |
| `biome publish <path>` | `xema-shell:biome.publish@1` | **no** | Publish a biome to the [Store](./store.md) |
| `db attach` / `db detach` | `xema-shell:db.attach@1` / `.detach@1` | **no** | Attach or detach a database from a project |

There is no `grant` command. The Shell creates no capability grants: conferring authority is done by an organisation administrator through the org-admin Grants screen, so that the grant is written under that administrator's own authority rather than under a service account's.

`run`, `biome install`, `biome publish`, `db attach` and `db detach` are declared and reachable but not yet backed by their downstream service call — each returns a typed pending status and a non-zero exit rather than doing anything. `memory recall` is the same: it makes no `memory-api` call, so agents use the `memory:recall@1` capability instead (see [Memory](./memory.md)). `capabilities explain` parses the ref and returns its parts, but its `binding` field is always `null` while the router's resolver is a stub — it tells you the ref is well-formed, not that the capability exists. The descriptors are live and the shape is stable; the behaviour behind those is not.

`cat`, `explain` and `inspect` currently resolve a canonical `xema://…` ref only. An XVFS path is refused with `SHELL_NOT_IMPLEMENTED` — walk a scope with `ls` first and resolve a ref from that listing.

The agent-facing entry point is `xema-shell:run@1`, which always returns structured JSON.

---

## `safeForAgents` and the Shell-vs-capability rule

Not every command should be reachable by every agent. `safeForAgents` is declared on the command and carried onto its **capability**, where the platform enforces it at the two boundaries an agent crosses: the session launch resolver refuses to arm a vetoed capability, and the capability router refuses an agent invocation of one. Neither a grant, a role, an org baseline nor a privileged human's authority overrides it, and a human may still run the command.

- `safeForAgents=true` — discovery, inspection, help, concept lookup, `why-denied`, `doctor`, read-only `ls` / `cat` / `inspect`, and read-only database introspection.
- `safeForAgents=false` — destructive admin actions, lifecycle transitions like `biome publish`, migrations, anything that mutates a Store listing, anything that grants capabilities.

An agent needing a `safeForAgents=false` action reaches for the underlying capability directly — a separate ref with its own declaration and its own authority — rather than the Shell command that wraps it. The Shell is the discovery surface, not a bulk-action surface.

`run` is the sharpest case and the reason this is a fence rather than a label: it dispatches an arbitrary target capability, so an agent holding it would carry a per-capability limit and a general way around it at the same time.

---

## The sandbox terminal — for biome build containers only

A **separate** terminal lives at `xema-shell-api`'s `/sandbox/terminal/:installationId` (Wave 2). This terminal is **not** the Xema Shell — it is a `node-pty`-backed real Linux PTY exposed to Biome Studio's "open a real terminal in my biome's build container" surface.

Hard constraints:

- The PTY runs in the `sandbox` execution environment only. Production environments are refused at the gateway.
- The PTY has no org credentials and no production data access.
- The PTY is the **only** place in Xema where a literal shell exists. Every other "terminal" surface is the structured Xema Shell.
- Authorization: a sandbox-environment grant for `biome:sandbox.terminal@1` is required; the grant is scoped to the calling subject's own draft biome installation.

The split is deliberate: the Xema Shell stays auditable, replayable, and parseable; sandbox terminals stay isolated, ephemeral, and bounded to biome authoring.

---

## Discovery vs runtime work

Agents that loop on `ls` instead of subscribing to the relevant Object Registry event are a performance anti-pattern. The Shell is for **discovery, inspection, lifecycle transitions, and one-shot calls**; high-frequency runtime work goes through the underlying capability directly.

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
