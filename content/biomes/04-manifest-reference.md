<!--
  AUTO-GENERATED — DO NOT EDIT BY HAND.
  Source of truth: BiomeManifestSchema in @xemahq/kernel-contracts
  (src/biome/lib/biome-manifest.ts).
  Regenerate from the xema-kernel-contracts repo:
    packages/kernel/kernel-contracts: pnpm build && pnpm run docs:manifest-reference
-->

# Manifest Reference

Field-by-field reference for **`xema-biome.json`**, generated directly from the platform manifest schema so it can never drift from what the biome host actually validates. The manifest is the wrapped `{ "name", "version", "xema": { … } }` shape; everything under `xema` is discriminated on `xema.target` (`server` or `web`).

For the narrative guide — folder layout, worked examples, validation workflow — read [Authoring](./02-authoring.md) first.

---

## Top-level shape

The manifest tolerates extra top-level fields (it doubles as an npm `package.json`-adjacent file), but validates these:

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | pattern `/^@[^/]+\/[^/]+$/` |
| `version` | string | yes | — |
| `xema` | object (discriminated on `target`) — see **Server biomes below**, **Web biomes below** | yes | — |

---

## Server biomes (`xema.target: "server"`)

A server biome ships backend contributions — agents, skills, workflows, optional API services — that the biome host boots and supervises.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | pattern `/^[a-z][a-z0-9-]*$/` |
| `displayName` | string | yes | — |
| `description` | string | no | — |
| `display` | object — see **xema.display** | no | — |
| `tags` | string[] | no | — |
| `scope` | enum | yes | one of: `kernel`, `system`, `base`, `platform` |
| `target` | literal "server" | yes | — |
| `capabilityDomain` | string | no | pattern `/^[a-z][a-z0-9-]*$/` |
| `components` | array of objects — see **xema.components[]** | yes | — |
| `dependencies` | string[] | no | entries: pattern `/^[a-z][a-z0-9-]*$/` |
| `extends` | string \| string[] | no | — |
| `capabilities` | object — see **xema.capabilities** | no | — |
| `trustTier` | enum | no | one of: `first-party`, `third-party` |
| `connectorRequirements` | array of objects — see **xema.connectorRequirements[]** | no | — |
| `webhookFilters` | array of objects — see **xema.webhookFilters[]** | no | — |
| `mcpWorkflowTools` | array of objects — see **xema.mcpWorkflowTools[]** | no | — |
| `mcpTools` | array of objects — see **xema.mcpTools[]** | no | — |
| `defaultToolSelection` | array of objects — see **xema.defaultToolSelection[] (kind: "provider")**, **xema.defaultToolSelection[] (kind: "tool")** | no | max 64 entries |
| `agents` | array of objects — see **xema.agents[]** | no | — |
| `provisioning` | array of objects — see **xema.provisioning[]** | no | — |
| `signature` | object — see **xema.signature** | no | — |
| `bundleSource` | object (discriminated on `kind`) — see **xema.bundleSource (kind: "npm")**, **xema.bundleSource (kind: "tarball")**, **xema.bundleSource (kind: "oci")** | no | — |
| `signedBy` | string | no | — |
| `requires` | map<string, string> | no | — |
| `contributes` | enum[] | no | entries one of: `mount-source`, `workflow-step`, `agent-skill`, `agent-kernel`, `model-resolution-dimension`, `widget-kind`, `surface-kind`, `artifact-type`, `inquiry-kind`, `role-capability`, `biome-install-schema`, `icon`, `project-kit`, `provisioning-scaffold`, `connector-adapter`, `workflow-config`, `deliverable-spec`, `workspace-manifest`, `tool-profile`, `mcp-catalog`, `opencode-tool`, `opencode-plugin`, `capability`, `resource-ownership`, `resource-definition`, `stage-machine`, `search-type`, `credential-strategy`, `canonical-object-type`, `ingestion-source` |
| `contributions` | object — see **xema.contributions** | no | — |
| `requiresCapabilities` | string[] | no | entries: pattern `/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*@\d+$/` |
| `exposesCapabilities` | string[] | no | entries: pattern `/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*@\d+$/` |
| `ownsCapabilityDomains` | string[] | no | entries: pattern `/^[a-z][a-z0-9-]*$/` |
| `permissions` | object — see **xema.permissions** | no | — |
| `lifecycle` | object — see **xema.lifecycle** | no | — |
| `mandatory` | boolean | no | — |
| `audience` | enum | no | one of: `org`, `operator` |
| `storeListed` | boolean | no | — |
| `kind` | enum | no | one of: `app`, `connector`, `library` |

### `xema.display`

| Field | Type | Required | Notes |
|---|---|---|---|
| `icon` | string | no | — |
| `category` | string | no | — |
| `summary` | string | no | — |
| `accent` | string | no | — |

### `xema.components[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | string | yes | pattern `/^[a-z][a-z0-9-]*$/` |
| `kind` | enum | yes | one of: `content`, `web`, `adapter`, `service`, `worker`, `job` |
| `artifact` | object — see **xema.components[].artifact** | yes | — |
| `entrypoint` | object (discriminated on `kind`) — see **xema.components[].entrypoint (kind: "materialize")**, **xema.components[].entrypoint (kind: "static-bundle")**, **xema.components[].entrypoint (kind: "module-export")**, **xema.components[].entrypoint (kind: "oci-default")** | yes | — |
| `protocol` | object (discriminated on `kind`) — see **xema.components[].protocol (kind: "none")**, **xema.components[].protocol (kind: "web")**, **xema.components[].protocol (kind: "adapter")**, **xema.components[].protocol (kind: "http")**, **xema.components[].protocol (kind: "worker")**, **xema.components[].protocol (kind: "job")** | yes | — |
| `hostAbi` | object — see **xema.components[].hostAbi** | no | — |
| `scheduler` | enum | no | one of: `platform`, `runtime` |
| `executionModes` | enum[] | yes | entries one of: `materialized`, `web-hosted`, `shared-host`, `composed`, `isolated`, `runner` |
| `requirements` | object — see **xema.components[].requirements** | yes | — |

### `xema.capabilities`

| Field | Type | Required | Notes |
|---|---|---|---|
| `mcp` | string[] | no | — |
| `network` | object — see **xema.capabilities.network** | no | — |
| `secrets` | string[] | no | — |

### `xema.connectorRequirements[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `adapterKind` | string | yes | pattern `/^[a-z][a-z0-9-]*$/` |
| `optional` | boolean | no | — |
| `purpose` | string | yes | — |
| `capabilities` | string[] | yes | entries: pattern `/^[a-z]+(\.[a-z][a-z0-9-]*)+$/` |

### `xema.webhookFilters[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `workflowId` | string | yes | pattern `/^[a-z][a-z0-9-]*$/` |
| `event` | string | yes | — |
| `entityKind` | string | no | — |
| `predicate` | expression (recursive structure — see the connector filter-expression contract) | yes | — |

### `xema.mcpWorkflowTools[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | string | yes | pattern `/^[a-z][a-z0-9-]*$/` |
| `workflowSlug` | string | yes | — |
| `displayName` | string | yes | — |
| `description` | string | yes | — |
| `outputProjection` | object — see **xema.mcpWorkflowTools[].outputProjection** | yes | — |
| `mount` | object — see **xema.mcpWorkflowTools[].mount** | no | — |

### `xema.mcpTools[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `key` | string | yes | pattern `/^[a-z][a-z0-9-]*$/` |
| `handler` | object — see **xema.mcpTools[].handler** | yes | — |

### `xema.defaultToolSelection[] (kind: "provider")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "provider" | yes | — |
| `providerKind` | enum | yes | one of: `mcp_server`, `catalog`, `biome_workflow_tools`, `biome_code_tools` |
| `resourceId` | string | yes | max 256 chars |

### `xema.defaultToolSelection[] (kind: "tool")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "tool" | yes | — |
| `providerKind` | enum | yes | one of: `mcp_server`, `catalog`, `biome_workflow_tools`, `biome_code_tools` |
| `resourceId` | string | yes | max 256 chars |
| `toolName` | string | yes | max 256 chars |

### `xema.agents[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `slug` | string | yes | pattern `/^[a-z][a-z0-9-_]*$/` |
| `mode` | enum | yes | one of: `primary`, `subagent` |

### `xema.provisioning[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | pattern `/^[a-z][a-z0-9-]*$/` |
| `kind` | enum | yes | one of: `scaffold`, `equip` |
| `triggers` | enum[] | yes | entries one of: `workspace-boot`, `runtime-request` |
| `guard` | enum | yes | one of: `repo_empty`, `path_absent`, `marker_absent`, `always` |
| `selector` | object — see **xema.provisioning[].selector** | yes | — |

### `xema.signature`

| Field | Type | Required | Notes |
|---|---|---|---|
| `algorithm` | string | yes | — |
| `value` | string | yes | — |
| `keyId` | string | yes | — |

### `xema.bundleSource (kind: "npm")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "npm" | yes | — |
| `name` | string | yes | — |
| `version` | string | yes | — |
| `registryUrl` | string | no | — |
| `authTokenEnv` | string | no | — |

### `xema.bundleSource (kind: "tarball")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "tarball" | yes | — |
| `uploadId` | string | yes | — |

### `xema.bundleSource (kind: "oci")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "oci" | yes | — |
| `ociRef` | string | yes | — |

### `xema.contributions`

| Field | Type | Required | Notes |
|---|---|---|---|
| `directory` | string | no | — |
| `inline` | array of objects — see **xema.contributions.inline[]** | no | — |

### `xema.permissions`

| Field | Type | Required | Notes |
|---|---|---|---|
| `defaultProfile` | enum | yes | one of: `read-only-assistant`, `support-chatbot`, `internal-agent`, `workflow-runner`, `connector-bridge`, `power-user-developer`, `org-admin-tool`, `sandbox-only`, `unrestricted` |
| `hints` | array of objects — see **xema.permissions.hints[]** | yes | — |
| `groups` | array of objects — see **xema.permissions.groups[]** | no | — |

### `xema.lifecycle`

| Field | Type | Required | Notes |
|---|---|---|---|
| `onInstall` | string | no | — |
| `onUninstall` | string | no | — |
| `onUpgrade` | string | no | — |
| `onEnable` | string | no | — |
| `onDisable` | string | no | — |

### `xema.components[].artifact`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | enum | yes | one of: `package-content`, `web-bundle`, `host-module`, `oci-image` |
| `path` | string | yes | — |

### `xema.components[].entrypoint (kind: "materialize")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "materialize" | yes | — |

### `xema.components[].entrypoint (kind: "static-bundle")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "static-bundle" | yes | — |
| `root` | string | yes | — |

### `xema.components[].entrypoint (kind: "module-export")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "module-export" | yes | — |
| `module` | string | yes | — |
| `exportName` | string | yes | — |

### `xema.components[].entrypoint (kind: "oci-default")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "oci-default" | yes | — |

### `xema.components[].protocol (kind: "none")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "none" | yes | — |

### `xema.components[].protocol (kind: "web")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "web" | yes | — |
| `revision` | string | yes | pattern `/^v[1-9]\d*$/` |

### `xema.components[].protocol (kind: "adapter")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "adapter" | yes | — |
| `revision` | string | yes | pattern `/^v[1-9]\d*$/` |

### `xema.components[].protocol (kind: "http")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "http" | yes | — |
| `revision` | string | yes | pattern `/^v[1-9]\d*$/` |
| `serviceName` | string | yes | pattern `/^[a-z][a-z0-9-]*$/` |
| `displayName` | string | no | — |
| `basePath` | string | no | pattern `/^\//` |
| `openapi` | string | no | — |
| `authScopes` | enum[] | yes | entries one of: `public`, `org`, `project`, `installation` |
| `requiresServices` | string[] | no | — |
| `optionalServices` | string[] | no | — |
| `exposesCapabilities` | string[] | no | — |
| `capabilities` | array of objects — see **xema.components[].protocol.capabilities[]** | no | — |
| `databaseKey` | string | no | pattern `/^[a-z][a-z0-9-]*$/` |

### `xema.components[].protocol (kind: "worker")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "worker" | yes | — |
| `revision` | string | yes | pattern `/^v[1-9]\d*$/` |

### `xema.components[].protocol (kind: "job")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "job" | yes | — |
| `revision` | string | yes | pattern `/^v[1-9]\d*$/` |

### `xema.components[].hostAbi`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | enum | yes | one of: `xema-web-host`, `xema-adapter-host`, `xema-service-host`, `xema-worker-runtime`, `xema-job-runner` |
| `versionRange` | string | yes | — |

### `xema.components[].requirements`

| Field | Type | Required | Notes |
|---|---|---|---|
| `tenancy` | object — see **xema.components[].requirements.tenancy** | yes | — |
| `isolation` | object — see **xema.components[].requirements.isolation** | yes | — |
| `trust` | object — see **xema.components[].requirements.trust** | yes | — |
| `locality` | object — see **xema.components[].requirements.locality** | yes | — |
| `state` | object (discriminated on `kind`) — see **xema.components[].requirements.state (kind: "stateless")**, **xema.components[].requirements.state (kind: "ephemeral")**, **xema.components[].requirements.state (kind: "durable")** | yes | — |
| `resources` | object — see **xema.components[].requirements.resources** | yes | — |
| `runtime` | object — see **xema.components[].requirements.runtime** | yes | — |
| `io` | object — see **xema.components[].requirements.io** | yes | — |
| `scaling` | object — see **xema.components[].requirements.scaling** | yes | — |

### `xema.capabilities.network`

| Field | Type | Required | Notes |
|---|---|---|---|
| `allowList` | string[] | yes | — |

### `xema.mcpWorkflowTools[].outputProjection`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "deliverable" | yes | — |
| `slug` | string | yes | — |

### `xema.mcpWorkflowTools[].mount`

| Field | Type | Required | Notes |
|---|---|---|---|
| `slot` | enum | yes | one of: `inputs`, `references`, `deliverables` |
| `as` | string | yes | — |

### `xema.mcpTools[].handler`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "biome_api" | yes | — |
| `method` | enum | no | one of: `POST`; default `"POST"` |

### `xema.provisioning[].selector`

| Field | Type | Required | Notes |
|---|---|---|---|
| `configPointer` | string | yes | — |
| `matchKind` | enum | yes | one of: `each-app-target` |

### `xema.contributions.inline[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | enum | yes | one of: `mount-source`, `workflow-step`, `agent-skill`, `agent-kernel`, `model-resolution-dimension`, `widget-kind`, `surface-kind`, `artifact-type`, `inquiry-kind`, `role-capability`, `biome-install-schema`, `icon`, `project-kit`, `provisioning-scaffold`, `connector-adapter`, `workflow-config`, `deliverable-spec`, `workspace-manifest`, `tool-profile`, `mcp-catalog`, `opencode-tool`, `opencode-plugin`, `capability`, `resource-ownership`, `resource-definition`, `stage-machine`, `search-type`, `credential-strategy`, `canonical-object-type`, `ingestion-source` |
| `id` | string | yes | pattern `/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/` |
| `manifest` | unknown (free-form JSON) | yes | — |

### `xema.permissions.hints[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `capability` | string | yes | pattern `/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*@\d+$/` |
| `reason` | string | yes | — |
| `suggestedResource` | string | no | — |
| `suggestedScope` | map<string, unknown (free-form JSON)> | no | — |
| `riskTier` | enum | yes | one of: `low`, `medium`, `high`, `critical` |

### `xema.permissions.groups[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | — |
| `capabilities` | string[] | yes | entries: pattern `/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*@\d+$/` |

### `xema.components[].protocol.capabilities[]`

| Field | Type | Required | Notes |
|---|---|---|---|
| `protocol` | string | yes | pattern `/^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9._-]*$/` |
| `revision` | string | yes | — |
| `operations` | string[] | yes | entries: pattern `/^[a-z][a-z0-9._-]*$/` |
| `references` | string[] | no | — |
| `endpointProtocols` | enum[] | no | entries one of: `http`, `grpc`, `event-hub`, `mcp` |

### `xema.components[].requirements.tenancy`

| Field | Type | Required | Notes |
|---|---|---|---|
| `allowed` | enum[] | yes | entries one of: `deployment`, `org`, `project`, `invocation` |
| `tenantContext` | enum | yes | one of: `none`, `verified` |

### `xema.components[].requirements.isolation`

| Field | Type | Required | Notes |
|---|---|---|---|
| `minimum` | enum | yes | one of: `none`, `process`, `container`, `vm` |

### `xema.components[].requirements.trust`

| Field | Type | Required | Notes |
|---|---|---|---|
| `minimum` | enum | yes | one of: `untrusted`, `verified`, `trusted`, `system` |

### `xema.components[].requirements.locality`

| Field | Type | Required | Notes |
|---|---|---|---|
| `allowed` | enum[] | yes | entries one of: `cloud`, `customer-private`, `gpu` |

### `xema.components[].requirements.state (kind: "stateless")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "stateless" | yes | — |

### `xema.components[].requirements.state (kind: "ephemeral")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "ephemeral" | yes | — |
| `recovery` | enum | yes | one of: `rebuildable`, `checkpointed` |

### `xema.components[].requirements.state (kind: "durable")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "durable" | yes | — |
| `scope` | enum | yes | one of: `deployment`, `org`, `project` |
| `persistence` | enum | yes | one of: `database`, `object-store`, `filesystem` |
| `consistency` | enum | yes | one of: `eventual`, `strong` |
| `tenantFencing` | literal "required" | yes | — |

### `xema.components[].requirements.resources`

| Field | Type | Required | Notes |
|---|---|---|---|
| `minimum` | object — see **xema.components[].requirements.resources.minimum** | yes | — |
| `preferred` | object — see **xema.components[].requirements.resources.minimum** | no | — |
| `accelerator` | object — see **xema.components[].requirements.resources.accelerator** | no | — |

### `xema.components[].requirements.runtime`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | enum | yes | one of: `none`, `node`, `python`, `go`, `wasm`, `native` |
| `versionRange` | string | no | — |
| `architectures` | enum[] | no | entries one of: `amd64`, `arm64` |
| `nativeLibraries` | string[] | no | — |

### `xema.components[].requirements.io`

| Field | Type | Required | Notes |
|---|---|---|---|
| `ingress` | enum | yes | one of: `none`, `http`, `webhook` |
| `egress` | enum | yes | one of: `none`, `platform`, `internet` |
| `rawBody` | boolean | yes | — |
| `devices` | enum[] | yes | entries one of: `accelerator`, `camera`, `microphone`, `serial`, `usb` |

### `xema.components[].requirements.scaling`

| Field | Type | Required | Notes |
|---|---|---|---|
| `mode` | enum | yes | one of: `singleton`, `horizontal`, `partitioned`, `invocation-only` |
| `concurrency` | object — see **xema.components[].requirements.scaling.concurrency** | yes | — |
| `readiness` | object (discriminated on `kind`) — see **xema.components[].requirements.scaling.readiness (kind: "none")**, **xema.components[].requirements.scaling.readiness (kind: "protocol")**, **xema.components[].requirements.scaling.readiness (kind: "host-signal")** | yes | — |
| `drain` | object (discriminated on `kind`) — see **xema.components[].requirements.scaling.drain (kind: "none")**, **xema.components[].requirements.scaling.drain (kind: "graceful")** | yes | — |
| `hints` | object — see **xema.components[].requirements.scaling.hints** | yes | — |

### `xema.components[].requirements.resources.minimum`

| Field | Type | Required | Notes |
|---|---|---|---|
| `cpu` | string | yes | pattern `/^(?:[1-9]\d*m|0\.(?:00[1-9]|0[1-9]\d|[1-9]\d{0,2})|[1-9]\d*(?:\.\d{1,3})?)$/` |
| `memory` | string | yes | pattern `/^[1-9]\d*(?:Ki|Mi|Gi|Ti)$/` |
| `ephemeralStorage` | string | yes | pattern `/^[1-9]\d*(?:Ki|Mi|Gi|Ti)$/` |

### `xema.components[].requirements.resources.accelerator`

| Field | Type | Required | Notes |
|---|---|---|---|
| `count` | number | yes | integer; > 0 |
| `preferredCount` | number | no | integer; > 0 |
| `vendor` | string | no | — |
| `class` | string | no | — |
| `minimumMemory` | string | no | pattern `/^[1-9]\d*(?:Ki|Mi|Gi|Ti)$/` |
| `features` | string[] | no | — |

### `xema.components[].requirements.scaling.concurrency`

| Field | Type | Required | Notes |
|---|---|---|---|
| `handling` | enum | yes | one of: `serial`, `parallel` |
| `maximumPerInstance` | number | yes | integer; > 0 |

### `xema.components[].requirements.scaling.readiness (kind: "none")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "none" | yes | — |

### `xema.components[].requirements.scaling.readiness (kind: "protocol")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "protocol" | yes | — |
| `initialDelaySeconds` | number | yes | integer; min 0 |

### `xema.components[].requirements.scaling.readiness (kind: "host-signal")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "host-signal" | yes | — |
| `initialDelaySeconds` | number | yes | integer; min 0 |

### `xema.components[].requirements.scaling.drain (kind: "none")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "none" | yes | — |

### `xema.components[].requirements.scaling.drain (kind: "graceful")`

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | literal "graceful" | yes | — |
| `maximumSeconds` | number | yes | integer; > 0 |

### `xema.components[].requirements.scaling.hints`

| Field | Type | Required | Notes |
|---|---|---|---|
| `cpu` | enum | yes | one of: `latency`, `throughput`, `batch` |
| `memory` | enum | yes | one of: `steady`, `burstable` |
| `startup` | enum | yes | one of: `fast`, `warmup` |

---

## Web biomes (`xema.target: "web"`)

A web biome is a static frontend bundle the host shell loads; it contributes pages, navigation entries, and slot panels, and never runs server-side.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | pattern `/^[a-z][a-z0-9-]*$/` |
| `displayName` | string | yes | — |
| `description` | string | no | — |
| `display` | object — see **xema.display** | no | — |
| `tags` | string[] | no | — |
| `scope` | enum | yes | one of: `kernel`, `system`, `base`, `platform` |
| `target` | literal "web" | yes | — |
| `components` | array of objects — see **xema.components[]** | yes | — |
| `systemSurface` | boolean | no | — |
| `requiresServerBiomes` | string[] | no | entries: pattern `/^[a-z][a-z0-9-]*$/` |
| `optionalServerBiomes` | string[] | no | entries: pattern `/^[a-z][a-z0-9-]*$/` |
| `capabilities` | object — see **xema.capabilities** | no | — |
| `signature` | object — see **xema.signature** | no | — |
| `bundleSource` | object (discriminated on `kind`) — see **xema.bundleSource (kind: "npm")**, **xema.bundleSource (kind: "tarball")**, **xema.bundleSource (kind: "oci")** | no | — |
| `signedBy` | string | no | — |
| `requires` | map<string, string> | no | — |
| `contributes` | enum[] | no | entries one of: `mount-source`, `workflow-step`, `agent-skill`, `agent-kernel`, `model-resolution-dimension`, `widget-kind`, `surface-kind`, `artifact-type`, `inquiry-kind`, `role-capability`, `biome-install-schema`, `icon`, `project-kit`, `provisioning-scaffold`, `connector-adapter`, `workflow-config`, `deliverable-spec`, `workspace-manifest`, `tool-profile`, `mcp-catalog`, `opencode-tool`, `opencode-plugin`, `capability`, `resource-ownership`, `resource-definition`, `stage-machine`, `search-type`, `credential-strategy`, `canonical-object-type`, `ingestion-source` |
| `contributions` | object — see **xema.contributions** | no | — |
| `requiresCapabilities` | string[] | no | entries: pattern `/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*@\d+$/` |
| `exposesCapabilities` | string[] | no | entries: pattern `/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*@\d+$/` |
| `ownsCapabilityDomains` | string[] | no | entries: pattern `/^[a-z][a-z0-9-]*$/` |
| `permissions` | object — see **xema.permissions** | no | — |
| `lifecycle` | object — see **xema.lifecycle** | no | — |
| `mandatory` | boolean | no | — |
| `audience` | enum | no | one of: `org`, `operator` |
| `storeListed` | boolean | no | — |
| `kind` | enum | no | one of: `app`, `connector`, `library` |

### `xema.capabilities`

| Field | Type | Required | Notes |
|---|---|---|---|
| `slots` | string[] | no | — |
| `apiClients` | string[] | no | — |

### `xema.signature`

| Field | Type | Required | Notes |
|---|---|---|---|
| `algorithm` | string | yes | — |
| `value` | string | yes | — |
| `keyId` | string | yes | — |

---

## Convention content directories

Biome content is discovered by **on-disk presence** — there is no per-kind declaration list in the manifest. Drop files into the conventional directory and the platform seeds them at boot/install:

| Content kind | Directory | What goes in it |
|---|---|---|
| `agents` | `agents/` | Agent definition files, one `<slug>.md` per agent. Every file must also be declared in `xema.agents[]` (parity is validated at boot). |
| `artifactTypes` | `artifact-types/` | Custom artifact type definitions. |
| `biomeInstallSchema` | `install-schema/` | Install-wizard resource-selection schema. Required when the biome declares `integrationRequirements[]`. |
| `deliverableSpecs` | `deliverable-specs/` | Deliverable spec bundles (structured output contracts). |
| `icons` | `icons/` | Icon assets referenced by the biome display metadata. |
| `mcpCatalog` | `mcp-catalog/` | MCP catalog entries the biome contributes. |
| `mcpTools` | `mcp-tools/` | MCP tool descriptors. |
| `projectKits` | `project-kits/` | Project kit definitions. |
| `provisioningScaffolds` | `provisioning/` | Workspace-provisioning scaffold recipes, one `<id>.yaml` per scaffold declared in `xema.provisioning[]`. |
| `roleCapabilities` | `role-capabilities/` | Role-to-capability mappings. |
| `runtimePlugins` | `plugins/` | Agent-runtime plugins, one directory per runtime id (`plugins/<runtimeId>/`). |
| `runtimeTools` | `tools/` | Agent-runtime custom tools, one directory per runtime id (`tools/<runtimeId>/`). |
| `skills` | `skills/` | Skill folder bundles, one directory per skill with a `SKILL.md` at its root (sub-skills nest recursively). Runtime-agnostic. |
| `toolProfiles` | `tool-profiles/` | Tool profile definitions. |
| `workflowConfig` | `workflow-config/` | Workflow YAML definitions and configuration. |
| `workspaceManifestTemplates` | `workspace-manifest-templates/` | Reusable agent-workspace manifest templates. |
| `workspaceManifests` | `workspace-manifests/` | Agent workspace manifests, one `<slug>.workspace.yaml` per workspace. |

Two content kinds pair a presence-discovered directory with an explicit manifest roster (parity is validated at boot):

- `agents/` ⟷ `xema.agents[]` — every `agents/<slug>.md` must be declared with its execution `mode`.
- `provisioning/` ⟷ `xema.provisioning[]` — every `provisioning/<id>.yaml` must have a matching scaffold declaration.

---

## Contribution envelopes

Single-file, typed contributions (capabilities, connector bindings, document templates, …) ship through the contribution protocol instead of a convention directory. Two equivalent forms, both validated against the same envelope shape:

1. **File-per-contribution** — one `*.contribution.json` per entry inside the biome's contributions directory (default `./contributions`, override with `xema.contributions.directory`).
2. **Inline** — entries under `xema.contributions.inline[]` in the manifest itself.

Directory entries are read first; inline entries layer on top (last write wins on a `(kind, id)` collision between the two forms, and duplicate entries fail the biome's boot fast).

Each envelope carries:

```json
{
  "kind": "capability",
  "id": "my-contribution-slug",
  "manifest": { }
}
```

- `kind` — a closed contribution-kind token (see the enum values in the `xema.contributes` row above).
- `id` — kind-local slug, unique per `(kind, biome)`; the platform namespaces it with the biome id at install time.
- `manifest` — the kind-specific body, validated by the owning platform service at boot.

---

**Previous**: [← Store](./03-store.md)

**Next**: [Examples →](./examples/)
