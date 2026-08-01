# SDK — Getting Started

This page walks you through authoring your first **biome** — Xema OS's name for an installable software bundle. You will install the `xema` CLI, scaffold a biome, install it into a local Xema instance, and invoke its first capability — end-to-end, in under five minutes, with no monorepo and no package manager.

---

## Prerequisites

- A machine running macOS, Linux, or Windows.
- One of:
  - **Homebrew** on macOS/Linux (`brew`), or
  - **Node.js 18+** with `npm` available, or
  - A direct GitHub Releases download for your platform.

No clone, no package manager, no pre-existing Xema install required. The CLI bootstraps a local instance for you.

---

## 1. Install the `xema` CLI

Pick the distribution that fits your platform.

```bash
# Homebrew (macOS, Linux)
brew tap xema-dev/xema
brew install xema

# npm (any platform)
npm install --global @xemahq/xema

# Or download a standalone binary from the GitHub Releases of xema-community
```

Verify:

```bash
xema --version
```

See the [CLI page](../cli.md) for every command and every install variant.

---

## 2. Start a local Xema

```bash
xema dev
```

This boots a single-binary Xema instance at `http://localhost:7331`. Everything — kernel server, capability router, authorization, object registry, identity provider — runs in one process backed by local files in `~/.xema/dev/`. Stop with `Ctrl+C`; restart any time.

Leave `xema dev` running in one terminal. Open a second terminal for the rest of the walkthrough.

---

## 3. Scaffold a biome

```bash
xema biome scaffold hello-xema
cd hello-xema
```

`xema biome scaffold` produces a self-contained directory:

```
hello-xema/
├── xema-biome.json             # the manifest
├── contributions/
│   └── hello.greet.contribution.json
├── agents/
│   └── greeter.agent.yaml
├── README.md
└── .gitignore
```

Open `xema-biome.json` to see the generated manifest. Open `contributions/hello.greet.contribution.json` to see the one example capability the scaffolder included.

---

## 4. Install the biome

```bash
xema biome install ./
```

The install command runs the full install flow against your local `xema dev` instance:

- Parses and validates the manifest.
- Computes the permission digest (one capability in this case: `hello:greet@1`).
- Records the install grant in the local authorization store.
- Registers the capability with the local router.

Sandbox is the default environment for a freshly scaffolded biome. You can move it to `org` later via the Org Settings UI.

---

## 5. Invoke the capability

```bash
xema run hello:greet@1 --name Eduardo
```

Expected output:

```jsonc
{ "message": "Hello Eduardo from my first Xema biome" }
```

That is the end-to-end loop: scaffold, install, invoke. The same loop works against a single-VM self-host (`xema serve --profile=single-instance`) and against a multi-node cluster (`helm install xema-community`) without code changes.

---

## 6. Iterate

Edit `agents/greeter.agent.yaml`, edit the contribution manifest, add new contributions to `contributions/`. Then:

```bash
xema biome validate        # pre-boot checks: manifest, agents, contributions, skills, workflows
xema biome lint            # boundary + manifest + capability-call audit
xema biome install ./      # reinstall over the previous version
xema run hello:greet@1 --name Eduardo
```

Two checks run on every install:

- **Manifest schema** — the manifest is parsed by the Zod schema. Unknown closed-set values are rejected.
- **Boundary check** — your biome may only depend on its own files and on published `@xemahq/*` kernel packages.

---

## 7. Publish (when you are ready)

When the biome is ready to share:

```bash
xema biome publish ./
```

The publish command builds an OCI artifact, signs it, and pushes it to the configured registry. From there, anyone can install it with:

```bash
xema biome install oci://<registry>/<your-org>/hello-xema:1.0.0
```

See [SDK / Publishing](./publishing.md) for the full publish flow and registry options.

---

## What to read next

- **[CLI](../cli.md)** — every `xema` command, every install variant.
- **[Manifest reference](./manifest.md)** — every field of `xema-biome.json`, including `contributions`, `requiresCapabilities`, `exposesCapabilities`.
- **[Contributions](./contributions.md)** — authoring the `*.contribution.json` files in `contributions/`.
- **[Capabilities](../capabilities.md)** — how your biome asks for and exposes capabilities.
- **[Objects](../objects.md)** — the typed envelope every contribution becomes.

---

**Previous**: [← Capabilities](../capabilities.md)
**Next**: [Manifest reference →](./manifest.md)
