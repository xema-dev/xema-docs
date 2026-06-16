# Xema-as-Code

**Xema-as-Code** is declarative provisioning for the platform. The same resources you create by clicking through the UI — projects, model providers, model-resolution rules, and more — can be described in a file, planned, and applied. One reconciler converges the actual state of your org toward the declared desired state, the same way CloudFormation or Terraform converges cloud infrastructure.

There is **one control-plane API** behind three provisioning surfaces:

- the **frontend** — clicks in the Xema web app;
- the first-party **`xema` CLI** — a declarative `xema.yaml` applied with `xema apply`;
- the **Terraform provider** — the same resources expressed as HCL.

This is deliberately the AWS model: the Console, CloudFormation, and Terraform all drive the same underlying resource APIs. You pick the surface; the resources, the ownership rules, and the reconciliation behavior are identical underneath.

---

## Why ownership is the whole story

Every provisionable resource row carries a single ownership marker — `managedBy` — and that one field is what lets clicks and code coexist without fighting each other. The marker is a closed set:

| `managedBy` | Meaning | Reconciliation behavior |
|---|---|---|
| `ui` | Created or edited through the frontend | Never auto-reverted. The human owns it by hand. |
| `iac` | Owned by a declarative source (`xema.yaml` or Terraform) | **Declared-state-wins.** Drift is surfaced at `plan`; `apply` reconciles it back to the declared spec. |
| `seeder` | Owned by a boot/event reconciler (e.g. portals derived from installed web biomes) | The reconciler may create, update, and retire these. |
| `system` | Kernel/platform-shipped | Immutable from any provisioning surface. |

Two transitions make the model usable in practice:

- **Adopt** (`iac` / `seeder` → `ui`) — editing an automation-managed resource in the UI adopts it away from automation. From then on it is yours by hand and is never auto-reverted. This is the "I'll take it from here" action.
- **Import** (`ui` → `iac`) — bring an already-live resource that was created by clicking under declarative management, so a future `apply` owns it.

A reconciler **never touches a row it does not own**. An `iac`-managed apply will not silently mutate a `ui`-owned resource, and a UI edit will not be clobbered by the next `apply` — it is shown as drift, and the human decides.

---

## The resource model

A provisionable resource is identified by its **kind** — a member of the closed `XemaResourceKind` set. Each kind is a wire-stable slug:

```
org · project · portal · biome-install · provider · model ·
model-resolution-rule · skill · agent · role · grant · space ·
environment · team · deliverable-spec
```

> **Today's working set.** v1 wires three kinds end-to-end: **`project`**, **`provider`**, and **`model-resolution-rule`**. The other twelve kinds are recognized by the control plane — they are valid members of the closed set, and the manifest parser accepts them — but they are **not yet reconcilable**. A `plan` or `apply` that touches an unwired kind fails fast with a clear, kind-specific reason (HTTP `501`) explaining exactly which owning capability is missing. There is no silent stub and no kind is left unhandled. Expect the working set to grow one kind at a time.

### The manifest — `xema.yaml`

A `xema.yaml` is a `XemaManifest`: a declarative description of a set of resources for one org, applied as a named **Stack**.

```yaml
apiVersion: xema/v1
stack: production
resources:
  - kind: provider
    id: openai
    spec:
      name: OpenAI
      slug: openai
      apiType: openai
      baseUrl: https://api.openai.com/v1
      authType: api_key
      isActive: true

  - kind: model-resolution-rule
    id: default-rule
    spec:
      selector: {}          # empty selector = the org default rule
      targetKind: model_class
      targetModelClass: balanced
      priority: 0
      isDefault: true

  - kind: project
    id: web-app
    dependsOn:
      - provider.openai
    spec:
      name: Web App
      description: Customer-facing web application.
```

Field by field:

| Field | Required | What it is |
|---|---|---|
| `apiVersion` | yes | Always `xema/v1`. Consumers refuse a version they do not understand — fail-fast, never best-effort parse. |
| `stack` | no | The logical state name. When omitted, the applying surface supplies it (e.g. from `--stack`, defaulting to `default`). |
| `resources[]` | yes | The declared resources. |

Each entry in `resources[]` is a `ResourceDeclaration`:

| Field | Required | What it is |
|---|---|---|
| `kind` | yes | A `XemaResourceKind` member. |
| `id` | yes | Your stable logical id, unique per `kind` within the manifest. This is **not** the server-generated UUID — it is the name you choose and keep stable across applies. |
| `managedKey` | no | The natural key the owning resource upserts on. Defaults to `id`. Set it explicitly when the resource's natural key is itself a slug or ref. |
| `dependsOn` | no | A list of `"<kind>.<id>"` refs (e.g. `provider.openai`) that must be applied first. |
| `spec` | yes | The per-kind resource body. Its shape is owned and validated by the resource's owning service. |

The org is **never** written in the document — it comes from the authenticated apply context, so the same manifest is portable across orgs. `(kind, id)` must be unique within a manifest, and every `dependsOn` ref must resolve to a declared resource; both are validated fail-fast at parse time.

---

## The plan / apply lifecycle

A **Stack** is the named, org-scoped declarative state for the `xema.yaml` path — the CloudFormation-stack / Terraform-state-file analogue. It records the last-applied manifest plus a logical→physical mapping (which server-generated resource each `id` resolved to, and the content hash last applied). That mapping is what makes drift detection and clean re-applies possible.

`plan` produces a Terraform-style diff. Every change carries one action:

| Action | Marker | Meaning |
|---|---|---|
| `create` | `+` | Declared, no physical resource yet. |
| `update` | `~` | Declared spec differs from the last-applied spec (in-place). |
| `replace` | `-/+` | A change to an immutable field — destroy and recreate. |
| `delete` | `-` | In the Stack mapping but absent from the new manifest. |
| `noop` | `=` | Declared spec equals applied state; nothing to do. |

When the current actual state read back from the owning service differs from the Stack's last-applied state — someone changed it in the UI or via a direct API call — the plan flags it as **drift**. This is what makes the behavior Terraform-exact: drift is surfaced at plan time, and `apply` reconciles the resource back to the declared spec (or you adopt it away to keep the manual change).

---

## The `xema` CLI

The four Xema-as-Code subcommands all talk to your Xema control plane over the same org-admin surface. They resolve the endpoint and bearer token from explicit flags first, then from environment variables — there is no silent default; a missing value exits with an actionable configuration error.

| Source | Flag | Env var |
|---|---|---|
| Control-plane endpoint | `--endpoint <url>` | `XEMA_ENDPOINT` |
| Org-admin bearer token | `--token <jwt>` | `XEMA_TOKEN` |

```bash
export XEMA_ENDPOINT=https://xema.acme.dev
export XEMA_TOKEN=<org-admin-jwt>
```

### `xema plan`

Compute a side-effect-free plan and print the diff. Read-only — it never mutates and always exits 0.

```bash
xema plan -f xema.yaml --stack production
```

```
Stack: production
Drift detected — actual state differs from last apply.

  +   provider provider.openai
  ~   project project.web-app (drift)
  =   model-resolution-rule model-resolution-rule.default-rule

create 1, update 1, replace 0, delete 0, unchanged 1
```

### `xema apply`

Plan, print the diff, confirm, then reconcile the stack. Skip the prompt with `--auto-approve`.

```bash
xema apply -f xema.yaml --stack production
# ...prints the same plan block...
Apply these changes to stack "production"? [yes/no] yes
Applied to "production": 1 created, 1 updated, 0 retired, 1 unchanged.
```

```bash
xema apply -f xema.yaml --auto-approve     # non-interactive (CI)
```

When the plan has no changes, `apply` reports "No changes — stack is up to date." and exits 0.

### `xema export`

Render a stack's managed resources back out as a `xema.yaml`.

```bash
xema export --stack production -o xema.yaml
```

### `xema import`

Adopt already-live resources into a stack without mutating them — it maps live rows to the manifest's declarations so a future `apply` owns them. It prints how many were adopted and lists any declarations that matched nothing.

```bash
xema import -f xema.yaml --stack production
```

The `--stack` flag defaults to the manifest's `stack` field, then to `default`.

---

## Terraform

The Xema Terraform provider lives at **`github.com/xema-dev/xema-terraform-provider`** and is built on the Terraform Plugin Framework. Unlike the `xema.yaml` path, Terraform does not use a Stack — **Terraform Core owns its own state**, so drift is Terraform-exact and managed entirely through `terraform plan` / `terraform apply`.

Each `XemaResourceKind` is exposed as `xema_<kind_with_underscores>` (so `model-resolution-rule` becomes `xema_model_resolution_rule`). The three wired kinds map to three resources:

- `xema_project`
- `xema_provider`
- `xema_model_resolution_rule`

A minimal `main.tf`:

```hcl
terraform {
  required_providers {
    xema = {
      source = "xema-dev/xema"
    }
  }
}

provider "xema" {
  endpoint = "https://xema.acme.dev"   # or XEMA_ENDPOINT
  org      = "acme"                     # or XEMA_ORG
  token    = var.xema_token             # or XEMA_TOKEN
}

resource "xema_provider" "openai" {
  name      = "OpenAI"
  slug      = "openai"
  api_type  = "openai"
  base_url  = "https://api.openai.com/v1"
  auth_type = "api_key"
  is_active = true
}

resource "xema_project" "web_app" {
  name        = "Web App"
  description = "Customer-facing web application."
}

resource "xema_model_resolution_rule" "default" {
  selector   = {}
  is_default = true
  priority   = 0
}
```

The provider's configuration block reads `endpoint`, `org`, and `token`, each with a matching `XEMA_*` environment-variable fallback. Resources for the twelve not-yet-wired kinds are not exposed; they arrive as their owning capabilities are wired.

---

## When to use which surface

| You want… | Use |
|---|---|
| To click through a one-off change | The **frontend** |
| A reviewable, version-controlled description of an org's resources, native to Xema | The **`xema` CLI** + `xema.yaml` |
| To manage Xema alongside your cloud infrastructure in one Terraform workspace | The **Terraform provider** |

All three drive the same resources and the same ownership rules. A resource created in one surface is visible to the others; whoever owns it (`managedBy`) decides who may reconcile it.

---

## Related concepts

- [CLI](./cli.md) — the global `xema` binary that hosts the `plan` / `apply` / `export` / `import` commands.
- [Controllers](./controllers.md) — the reconciliation pattern (desired vs observed state) that Xema-as-Code applies to provisionable resources.
- [Agent Composition / Model Resolution](./agent-composition/02-model-resolution.md) — the Model Resolution Matrix whose rules `model-resolution-rule` declares.
- [Versioning](./versioning.md) — draft vs published; the schema-versioning discipline `apiVersion: xema/v1` follows.

---

**Previous**: [← CLI](./cli.md)
**Next**: [Skills →](./skills/)
