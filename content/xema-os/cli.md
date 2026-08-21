# CLI

The **`xema` CLI** is the single, multi-platform command-line entry point to Xema OS. It boots a local platform, scaffolds and validates biomes, installs them, invokes capabilities, drops you into the Shell, and runs diagnostics. The same binary works against a locally-booted platform, a self-hosted single-VM deployment, and a multi-node cluster.

---

## Install

```bash
npm install --global @xemahq/xema
# or
pnpm add --global @xemahq/xema
```

### Verify

```bash
xema --version
xema doctor
```

`xema doctor` checks the local substrate: node version, the `~/.xema/` config directory, the resolvable distribution editions, the license in force and what it entitles, the container runtime and its platform, free disk space, the host ports a launch publishes, and container-registry reachability. Every check is reported — a check that cannot be *evaluated* says so explicitly rather than passing quietly.

```bash
xema doctor                 # the local environment
xema doctor --infra         # also TCP-probe Postgres, Redis, etcd, event-hub-api, …
xema doctor --sources       # list the configured biome sources + whether their tokens are present
```

---

## Developer mode

The platform-contributor commands — `xema dev`, `xema up`, `xema serve` — are hidden from `--help` unless developer mode is on. They still run if invoked directly.

```bash
xema config set dev on      # persisted to ~/.xema/config.yaml
xema config get             # shows whether it is active, and why
```

The `XEMA_DEV` environment variable overrides the persisted setting at runtime.

---

## Commands

Every command takes `--help`.

### `xema up`

Boot the platform with one command. Resolves the distribution lock plus `xema.config.yaml` into an effective roster, brings up managed infrastructure, and supervises the service waves over the configured substrate (container or native). Foreground by default.

```bash
xema up
xema up --edition oss
xema up --only workflow-engine-api      # plus that service's hard prerequisites
xema up --dry-run                       # print the resolved roster, waves and ports; boot nothing
```

`xema down` stops what `up` started.

### `xema dev`

Boot the roster as host processes — one forked child per service — for local development. It probes Postgres / Redis / etcd / event-hub-api first and exits with an actionable `docker compose up` message if any are down.

```bash
xema dev
xema dev workflow-engine-api            # boot a subset; hard prerequisites are pulled in automatically
xema dev --watch                        # hot-reload from a source checkout
```

Passing a subset never boots a broken partial graph: the transitive hard prerequisites (`identity-api` and the foundational services) are always added.

### `xema serve`

Multi-process self-host launcher. `--substrate` is required and selects where services run.

```bash
xema serve --substrate single-instance   # native host processes
xema serve --substrate cluster           # containers
xema serve --substrate appliance
```

### `xema biome scaffold <name>`

Generate a new, valid biome directory — manifest, one example contribution, and the boundary-check config, so the new biome passes lint out of the box.

```bash
xema biome scaffold hello-xema
xema biome scaffold hello-web --target web --scope platform
```

### `xema biome validate [path]`

Run the pre-boot checks over a biome directory — manifest schema, `xema.agents[]` ⟷ `agents/*.md` parity, contribution envelopes, skill frontmatter, workflow schemas — without booting anything. Defaults to the current directory.

```bash
xema biome validate
xema biome validate ./my-biome
```

Exits `0` when every check passes and non-zero when one fails, listing every issue rather than only the first — so it drops straight into CI.

### `xema biome dev [path]`

The biome sandbox loop: the same validation pass, then overlay the directory as a workspace source (no publish, no token) and boot the smallest platform slice the biome needs.

```bash
xema biome dev
xema biome dev --dry-run       # validate + print the resolved slice, boot nothing
```

A workspace source always outranks every remote source for the same biome. That is what lets `xema biome dev` run local edits with no publish and no registry token.

### `xema biome search|list|info`

Browse the Store catalog.

```bash
xema biome search "code review"
xema biome list --trust-tier first-party
xema biome info <listingId>
```

### `xema biome install <biomeId>`

Install a catalog biome into a running platform, or fetch it to this machine so `xema dev` / `xema up` can boot it without a platform at all.

```bash
xema biome install acme-code-review --org <orgId>
xema biome install acme-code-review --project <projectId> --version 1.2.0
xema biome install acme-code-review --local --from my-registry
```

The install runs the same flow the Store uses — permission digest, install grant, capability registration. `xema biome remove <installId>` soft-uninstalls.

### `xema biome publish <path>`

Package the biome as an OCI artifact, push it (`oras push`), then sign the pushed ref (`cosign sign`).

```bash
COSIGN_KEY=cosign.key xema biome publish ./ --registry ghcr.io/acme --token-env GHCR_TOKEN
xema biome publish ./ --keyless                # what CI should use
xema biome publish ./ --dry-run                # print the resolved plan and the exact oras/cosign commands
```

Signing is mandatory. There is no unsigned mode. See [SDK — Publishing](./sdk/publishing.md#bundle-format--oci-artifacts) for the full flag set.

`xema biome submit <path>` submits a published artifact to your org's private Store catalog.

### `xema biome lint`

Run boundary and manifest checks across the workspace.

```bash
xema biome lint
xema biome lint --strict
```

### `xema run <capabilityRef>`

Invoke a capability through the platform's capability router (`POST /capabilities/invoke`).

```bash
xema run hello:greet@1 --input '{"name":"Eduardo"}'
xema run kb:page.read@1 --input @page.json
xema run xema-shell:concepts.list@1
```

The acting subject is always the token's `sub` claim — it cannot be overridden. The environment defaults to `environment:project` and is set with `--environment`. The full result (allow / denial / audit id) prints as JSON, and a denied invocation exits non-zero so scripts can branch.

### `xema shell`

An interactive REPL over the same router. Each line is `<capabilityRef> [inputJson]`.

```bash
xema shell
> xema-shell:ls@1 {"path":"/orgs/acme/projects/billing"}
> xema-shell:explain@1 {"ref":"xema://biomes/acme-code-review"}
```

Built-ins are `help` and `exit` / `quit`; Ctrl-D exits. Only an unreachable router at startup is fail-fast — an invocation error prints and the loop continues.

### `xema objects list|get`

Browse the typed object universe.

```bash
xema objects list --space xema://orgs/acme/projects/billing
xema objects list --type skill --limit 50
xema objects get xema://orgs/acme/skills/release-notes
```

### `xema plan|apply|export|import`

Declarative provisioning. See [Xema-as-Code](./iac.md).

### Other commands

| Command | What it does |
|---|---|
| `xema init` | Scaffold a `xema.config.yaml` |
| `xema login` | Device-code login; writes a session to `~/.xema/session.json` |
| `xema status` | What is running |
| `xema logs` | Service logs |
| `xema source` | Manage the biome source registry |
| `xema dist` | Resolve and fetch distribution editions |
| `xema license` | Inspect the license in force and what it entitles |
| `xema installation` | Installation-level operations |
| `xema canopy` | Canopy agent session operations |
| `xema config` | Inspect and change persisted CLI settings |

---

## Common workflows

### Authoring a biome end-to-end

```bash
xema biome scaffold my-biome
cd my-biome
# edit ./contributions, ./agents, ./skills, ./api...
xema biome validate
xema biome lint
xema biome dev                        # boot the smallest slice that runs it
xema biome publish ./                 # ship it
```

### Working against a running platform

```bash
export XEMA_ENDPOINT=https://xema.acme.dev
xema login
xema run kb:page.read@1 --input '{"pageId":"…"}'
xema shell
```

---

## Configuration

Persisted CLI settings live in `~/.xema/config.yaml`; the login session lives in `~/.xema/session.json` (owner-only). Platform configuration — the roster, biome sources, the edition — lives in `xema.config.yaml`, resolved through the standard search order or named with `--config`.

Connection details resolve identically for every command that talks to a platform:

| Flag | Environment variable | What it is |
|---|---|---|
| `--endpoint <url>` | `XEMA_ENDPOINT` | Platform API base URL |
| `--token <jwt>` | `XEMA_TOKEN` | Bearer token |
| `--org <id>` | `XEMA_ORG_ID` | Acting organization id |
| — | `XEMA_DEV` | Overrides the persisted developer-mode setting |

A private biome source names the environment variable that holds its token (`authTokenEnv`) — the secret is never written into `xema.config.yaml`. A variable that is named but unset fails fast; it never falls through to an unauthenticated request.

---

## Related concepts

- [Capabilities](./capabilities.md) — `xema run` invokes through the same surface.
- [Shell](./shell.md) — `xema shell` speaks the same capability surface the web terminal exposes.
- [Biomes](./biomes.md) — `xema biome` commands manage the lifecycle.
- [Xema-as-Code](./iac.md) — `xema plan` / `apply` / `export` / `import` drive declarative provisioning.
- [SDK / Getting Started](./sdk/getting-started.md) — the end-to-end walkthrough.

---

**Previous**: [← Developer Annotations](./developer-annotations.md)
**Next**: [Xema-as-Code →](./iac.md)
