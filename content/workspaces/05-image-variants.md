# Image Variants

Every workspace runs inside a container image. By default, all workspaces in an org use the Xema base image — a curated image with a standard set of development tools. **Image variants** let orgs ship their own toolchain by building custom images on top of the base.

---

## Why custom images?

The Xema base image includes common tools (Node.js, Python, git, common CLIs), but your biomes may need:

- A specific compiler version.
- Internal npm/PyPI/Maven registries pre-configured.
- Org-specific security tooling pre-installed.
- A larger working set of system dependencies.

Image variants let orgs meet these needs without patching the base image or installing tools at session startup.

---

## The image variant model

Each org can register multiple image variants:

```ts
interface ImageVariant {
  id: string;
  orgId: string;
  displayName: string;
  baseImage: string;         // e.g. "xema-base:2.1.0"
  dockerfile: string;        // the custom Dockerfile content
  tag: string;               // the resulting image tag in the container registry
  status: 'pending' | 'building' | 'ready' | 'failed';
  builtAt?: Date;
}
```

Variants are addressable by `tag` and can be assigned to:
- An org (all sessions in the org use this variant by default).
- A project (all sessions in this project use this variant).
- A workspace manifest (a specific workflow or interactive session uses this variant).

---

## Building an image variant

Image variants are built using [Kaniko](https://github.com/GoogleContainerTools/kaniko) — a secure, daemonless container builder that runs inside the Xema platform.

```bash
xema image-variant create \
  --name "acme-engineering" \
  --base "xema-base:2.1.0" \
  --dockerfile ./Dockerfile.acme
```

The build runs in the platform's isolated build environment. The resulting image is pushed to the org's container registry namespace and tagged. Build logs are available in the UI under **Org Settings → Image Variants → [variant name] → Build Logs**.

### Dockerfile constraints

Kaniko builds run without root access. Your Dockerfile must:

- Start `FROM xema-base:<version>` (the base image cascade enforces this).
- Not use `--privileged` or `--cap-add` directives.
- Use `USER xema` (UID 1000) for any final `CMD` or `ENTRYPOINT`.

---

## Base image cascade

Xema maintains a cascade of base images:

```
xema-base:2.1.0         ← the org-level starting point
  └── xema-base-node:2.1.0    ← Node.js + npm pre-installed
  └── xema-base-python:2.1.0  ← Python + pip pre-installed
  └── xema-base-jvm:2.1.0     ← JVM + Maven + Gradle pre-installed
```

When the Xema platform updates the base image, a **cascade rebuild** is triggered for all org variants that derive from the updated base. Org admins receive a notification; the rebuild is automatic if `autoBuildOnBaseUpdate: true` is set on the variant. Otherwise, a manual rebuild is required.

---

## Assigning a variant

In the workspace manifest:

```yaml
runtime:
  imageVariant: acme-engineering
```

Or set the default for the entire org:

```bash
xema org set-default-image-variant acme-engineering
```

---

**Previous**: [← Worker Runtime](./04-worker-runtime.md)

**Next**: [Versioning Lockfile →](./06-versioning-lockfile.md)
