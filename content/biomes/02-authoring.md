# Authoring a Biome

A biome is a folder with a `xema-biome.json` manifest at its root. Author against the current component contract and validate with the same schema the host uses.

---

## Start with the boundary

Before creating files, decide what the biome owns:

- one domain or integration;
- the capabilities it exposes and requires;
- the Agents, Skills, Workflows, and UI it contributes;
- whether it needs executable components;
- its tenancy, isolation, trust, locality, state, resource, and scaling requirements.

If another domain can use the same behavior only through a typed operation, expose a capability. Do not import the other biome's implementation.

---

## Typical layout

```text
customer-operations/
  xema-biome.json
  agents/
    operations-coordinator.md
  skills/
    incident-triage/
      SKILL.md
      references/
        policy.md
  workflow-config/
    handle-incident.yaml
  deliverable-specs/
    action-plan/
  workspace-manifests/
    operations.workspace.yaml
  contributions/
    incident-search.contribution.json
  api/
    operations-api/
```

Only include directories the biome uses. The complete convention-directory table is in the [Manifest Reference](./04-manifest-reference.md#convention-content-directories).

---

## Declare components

Every artifact the platform executes or materializes belongs in `xema.components[]`. The old `xema.ships.apis[]` field is not the current contract.

An HTTP service component looks like this:

```jsonc
{
  "key": "operations-api",
  "kind": "service",
  "artifact": { "kind": "oci-image", "path": "api/operations-api" },
  "entrypoint": { "kind": "oci-default" },
  "protocol": {
    "kind": "http",
    "revision": "v1",
    "serviceName": "operations-api",
    "authScopes": ["org", "project"],
    "exposesCapabilities": ["operations:incident.read@1"]
  },
  "scheduler": "platform",
  "executionModes": ["isolated"],
  "requirements": {
    "tenancy": { "allowed": ["org", "project"], "tenantContext": "verified" },
    "isolation": { "minimum": "container" },
    "trust": { "minimum": "verified" },
    "locality": { "allowed": ["cloud", "customer-private"] },
    "state": {
      "kind": "durable",
      "scope": "org",
      "persistence": "database",
      "consistency": "strong",
      "tenantFencing": "required"
    },
    "resources": { "minimum": { "cpu": "100m", "memory": "64Mi", "ephemeralStorage": "64Mi" } },
    "runtime": { "kind": "node", "versionRange": ">=22 <25" },
    "io": { "ingress": "http", "egress": "platform", "rawBody": false, "devices": [] },
    "scaling": {
      "mode": "horizontal",
      "concurrency": { "handling": "parallel", "maximumPerInstance": 16 },
      "readiness": { "kind": "protocol", "initialDelaySeconds": 0 },
      "drain": { "kind": "graceful", "maximumSeconds": 30 },
      "hints": { "cpu": "latency", "memory": "steady", "startup": "fast" }
    }
  }
}
```

Use `components[].artifact.path` as the source of truth for the source or artifact location. Do not infer it from a component key.

---

## Add Agents and Skills

Agents are listed under `xema.agents[]` and authored in `agents/`. The roster and files are cross-validated.

A Skill is a folder bundle whose only strict file is `SKILL.md`. References, scripts, assets, and recursive sub-skills stay inside the bundle and are mounted as a unit.

Agents and Skills are independently versioned resources. The same published Agent can run in a Workflow or an Interactive Session.

---

## Add contribution envelopes

Typed single-file contributions live under the configured contribution directory:

```json
{
  "kind": "capability",
  "id": "incident-read",
  "manifest": {}
}
```

The `kind` is a closed contract. A declared enum value is not automatically proof that a public ingestion path exists; consult [Contribution Kind](../xema-os/concepts/contribution-kind.md) for the generated current catalogue and ingestion status.

---

## Declare permissions honestly

List every capability the biome can request and provide a human-readable reason. A declaration is input to install consent and runtime arming; it is never a way to bypass a grant.

Prefer narrow, provider-neutral operations. Separate read, propose, approve, and mutate capabilities where the risk differs.

---

## Validate and publish

Use the biome CLI validation and lint commands available in your installed Xema SDK. Validation must cover:

- manifest schema;
- component requirements;
- Agent roster and file parity;
- Skill entry files;
- Workflow and deliverable schemas;
- contribution envelopes;
- capability-ref grammar;
- dependency and boundary rules.

Publish production biomes as immutable, signed artifacts. Keep mutable workspace sources in development and sandbox environments.

---

**Previous**: [← Concepts](./01-concepts.md)
**Next**: [Store →](./03-store.md)
