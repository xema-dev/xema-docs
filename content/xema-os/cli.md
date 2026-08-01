# CLI

The **`xema` CLI** is the single, multi-platform command-line entry point to Xema OS. It boots a local instance, scaffolds biomes, installs them, invokes capabilities, drops you into the Shell, and runs diagnostics. The same binary works against a single-binary `xema dev` instance, a self-hosted single-VM deployment, and a multi-node cluster.

The CLI never requires a Node.js toolchain or a package manager. It ships as a standalone binary per platform; npm and Homebrew distributions are convenience packaging on top.

---

## Install

Pick the distribution that fits your platform. The behaviour is identical across all of them.

### Homebrew (macOS, Linux)

```bash
brew tap xema-dev/xema
brew install xema
```

### npm (any platform with Node ≥ 18)

```bash
npm install --global @xemahq/xema
# or
pnpm add --global @xemahq/xema
# or
yarn global add @xemahq/xema
```

### Standalone binary

Download the latest release for your platform from the GitHub Releases page of `xema-community`:

- `xema-darwin-arm64`
- `xema-darwin-x64`
- `xema-linux-arm64`
- `xema-linux-x64`
- `xema-win-x64.exe`

Drop it on your PATH and you are done.

### Verify

```bash
xema --version
xema doctor
```

`xema doctor` checks that the CLI's expected runtime substrate (an active state store, a reachable kernel server, identity provider) is present. On a fresh laptop with no Xema running, `xema doctor` will say "no Xema instance detected — run `xema dev` to start one".

---

## Commands

The CLI is verb-noun. Every command takes `--help` and `--json`.

### `xema dev`

Start a single-binary Xema instance. Every platform service runs in one process; data is stored locally (a SQLite kernel state, per-service SQLite databases, in-memory event hub, a stub identity provider).

```bash
xema dev                    # default: http://localhost:7331
xema dev --port 8000
xema dev --workspace ~/x    # local data dir; default ~/.xema/dev
```

Stop with `Ctrl+C`. Data persists across runs unless `--ephemeral` is passed.

### `xema serve`

Run Xema in a multi-process self-host profile (Postgres + state store + cache + event hub + identity provider already provisioned by you). Used for single-VM and cluster deployments — the same binary, a different profile.

```bash
xema serve --profile=single-instance
xema serve --profile=cluster
```

### `xema biome scaffold <name>`

Generate a new biome project directory. The scaffolder writes the manifest, a single example contribution, a `README.md`, and the boundary-check config so the new biome passes lint out of the box.

```bash
xema biome scaffold hello-xema
cd hello-xema
```

There is no pnpm dependency, no monorepo assumption. The scaffolded directory is self-contained.

### `xema biome validate [path]`

Run the pre-boot checks over a biome directory — manifest schema, `xema.agents[]` ⟷ `agents/*.md` parity, contribution envelopes, skill frontmatter, workflow schemas — without booting anything. Works from anywhere inside the biome; defaults to the current directory.

```bash
xema biome validate            # validate the biome you are inside
xema biome validate ./my-biome
```

Exits `0` when every check passes and `3` when a check fails (every issue is listed, not just the first) — so it drops straight into CI.

### `xema biome dev [path]`

The biome sandbox loop: run the same validation pass, overlay the directory as a workspace source (no publish, no token), and boot the smallest platform slice the biome needs.

```bash
xema biome dev                 # validate + boot from inside the biome
xema biome dev --dry-run       # validate + print the resolved slice, boot nothing
```

### `xema biome install <ref-or-path>`

Install a biome into the local Xema instance.

```bash
xema biome install ./                   # install from a local directory
xema biome install ./dist/hello-xema    # install a built bundle
xema biome install oci://ghcr.io/acme/hello-xema:1.0.0   # install from an OCI registry
xema biome install https://example.com/hello-xema-1.0.0.tgz  # install from URL
```

The install command runs the same install flow the Store uses — permission digest, install grant, capability registration — exactly as if the biome had been fetched from the Store.

### `xema biome publish <path>`

Package the biome at `<path>` as an OCI artifact, push it to a registry (`oras push`), then sign the pushed ref (`cosign sign`). Used both for local Store-equivalent publishing and for first-party release pipelines.

```bash
COSIGN_KEY=cosign.key xema biome publish ./ --registry ghcr.io/acme --token-env GHCR_TOKEN
```

Signing is mandatory and keyed: with `COSIGN_KEY` unset the command fails before anything is pushed. There is no unsigned mode. `--dry-run` prints the resolved plan and the exact `oras` / `cosign` commands without touching the registry; see [SDK — Publishing](./sdk/publishing.md#bundle-format--oci-artifacts) for the full flag set.

### `xema biome lint`

Run boundary checks, manifest validation, and a capability-call audit against the biome rooted at the current directory.

```bash
xema biome lint                # lint current directory
xema biome lint --strict       # treat warnings as errors
```

### `xema run <capability-ref> [...args]`

Invoke a capability against the local Xema instance.

```bash
xema run hello:greet@1 --name Eduardo
# → { "message": "Hello Eduardo from my first Xema biome" }

xema run kb:page.read@1 --pageId 'xema://orgs/acme/kb/page/welcome'
```

`xema run` is the CLI face of `xema.capabilities.invoke`. The same authorization, audit, and policy flow applies — your CLI session is just another subject.

### `xema shell`

Drop into the interactive Xema Shell, same surface the web terminal exposes.

```bash
xema shell
xema-shell> ls xema://orgs/acme/projects/billing
xema-shell> explain xema://biomes/xema.document-buddy
```

### `xema objects list <space>`

List the typed objects anchored to a given Space.

```bash
xema objects list xema://orgs/acme/projects/billing
xema objects list xema://orgs/acme/projects/billing --kind artifact
```

### `xema doctor`

Diagnostics. Runs static checks (manifest validity, biome lint) and runtime checks (kernel reachable, every required service registered, no failed runners).

```bash
xema doctor                          # general
xema doctor biome                    # biome at current directory
xema doctor runners                  # runner attestation status
xema doctor services                 # service registry health
```

---

## Common workflows

### Day-zero — install and run your first biome

```bash
brew install xema-dev/xema/xema
xema dev                              # one process, localhost:7331

# in another shell:
xema biome scaffold hello-xema
cd hello-xema
xema biome install ./
xema run hello:greet@1 --name Eduardo
# → { "message": "Hello Eduardo from my first Xema biome" }
```

This sequence is the canonical first experience: a working Xema with one biome installed, capability invocation end-to-end, in under five minutes on a clean machine.

### Authoring a biome end-to-end

```bash
xema biome scaffold my-biome
cd my-biome
# edit ./contributions, ./agents, ./skills, ./api...
xema biome validate
xema biome lint
xema biome install ./
xema run my:something@1
# iterate
xema biome publish ./                 # ship it
```

### Working against a cluster

```bash
export XEMA_TARGET=https://xema.acme.dev
xema run kb:page.read@1 --pageId '...'
xema shell
```

The CLI uses the same authorization model as the web UI; on first contact it walks you through device-code login against your org's identity provider.

---

## Configuration

The CLI reads configuration from `~/.xema/config.json` (or `%USERPROFILE%\.xema\config.json` on Windows). Useful fields:

| Field | What it does |
|---|---|
| `target` | Default target Xema instance URL |
| `profile` | `dev` / `single-instance` / `cluster` for `xema serve` |
| `workspace` | Local data directory for `xema dev` |
| `output` | `human` (default) or `json` |
| `identity.profiles` | Saved credentials for multiple targets |

Anything in the config can be overridden by a flag (`--target`, `--profile`, …) or an environment variable (`XEMA_TARGET`, `XEMA_PROFILE`, …).

---

## Related concepts

- [Capabilities](./capabilities.md) — `xema run` invokes through the same surface.
- [Shell](./shell.md) — `xema shell` is the same shell the web terminal exposes.
- [Biomes](./biomes.md) — `xema biome` commands manage the lifecycle.
- [Service registry](./service-registry.md) — `xema doctor services` inspects it.
- [Xema-as-Code](./iac.md) — `xema plan` / `apply` / `export` / `import` drive declarative provisioning.
- [SDK / Getting Started](./sdk/getting-started.md) — the end-to-end walkthrough.

---

**Previous**: [← Developer Annotations](./developer-annotations.md)
**Next**: [Xema-as-Code →](./iac.md)
