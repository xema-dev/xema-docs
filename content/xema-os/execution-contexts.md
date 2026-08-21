# Execution Contexts

An **ExecutionContext** is the per-invocation envelope that travels with every capability call. It binds together *who* is calling (subject), *where the data lives* (Space), *what trust profile applies* (Environment), *what they are asking for* (capability ref + input), and the caller's correlation IDs. Every authorization decision, every audit-log entry, and every runner dispatch reads from this one shape.

Where Spaces and Environments are durable, ExecutionContext is **ephemeral** — built fresh for each invocation, then discarded after the response is audited.

---

## The envelope shape

The contract lives in `@xemahq/kernel-contracts/execution-context`:

```ts
interface ExecutionContext {
  // Who is calling
  subject:     SubjectRef;       // { kind: SubjectKind; id: string }
  caller:      CallerKind;       // 'user' | 'agent' | 'workflow' | 'app' | 'service' | 'runner'
  callerOrigin?: string;         // optional UI origin or service name

  // Where data lives + what trust profile applies
  space:       SpaceRef;         // xema://orgs/acme/projects/billing
  environment: ExecutionEnvironmentId;  // 'org' | 'project' | 'sandbox' | …

  // What is being asked
  capability:  CapabilityRef;    // 'connector:scm.create-pull-request@1'
  input:       unknown;          // schema-validated against describe(ref)

  // Correlation
  invocationId: string;          // ULID; one per call
  parentInvocationId?: string;   // for sub-agent / nested-step lineage
  traceId?:     string;          // OpenTelemetry-compatible

  // Policy-mediated annotations (filled in by the router)
  allowedCapabilities?: CapabilityRef[];   // set after policy resolution
  obligations?:         PolicyObligation[];
  routeHints?:          RouteHint[];

  // Audit metadata
  auditId?:     string;          // populated after the audit-log row exists
}
```

The closed enums `SubjectKind`, `CallerKind`, `SpaceKind`, and `ExecutionEnvironmentId` make the envelope statically typed end-to-end. Unknown values fail-fast at the router boundary.

---

## What flows where

```
caller (UI / agent / workflow / external app)
   │  Constructs minimal context: { subject, capability, input }
   ▼
xema-capability-router
   │  Resolves Space + Environment from session/active context.
   │  Builds the full ExecutionContext.
   ▼
authorization-api.policyCheck(context)
   │  Returns PolicyDecision: allow | deny | needs_approval
   │  Plus obligations + routeHints
   ▼
router updates context.{allowedCapabilities, obligations, routeHints}
   │
   ▼
runner dispatch
   │  Receives the full context (signed); enforces routeHints.
   ▼
audit-log-api
      Persists the complete envelope with the decision.
```

The router is the **only** process that builds the full context. Subjects (agents, UIs, workflows) provide the minimal triplet `{ subject, capability, input }`; the router fills in Space, Environment, correlation IDs, and audit metadata. Subjects cannot forge `environment` or `space`.

---

## Building a context from a session

Most invocations originate inside a session. The router resolves Space + Environment by walking the session's lineage:

| Session kind | Default Space | Default Environment |
|---|---|---|
| Project workspace session | `xema://orgs/<org>/projects/<project>` | `project` |
| Org admin console session | `xema://orgs/<org>` | `org` |
| Sandbox build session | `xema://biomes/<biome>` | `sandbox` |
| Delegated app session | `xema://orgs/<org>/apps/<app>` | `app` or `public` |
| Personal session | `xema://users/<userId>` | `org` (fallback to `user`) |

A subject may **request** an alternate Space or Environment via the Shell's `--space` / `--environment` flags or the capability invoker's `requestedEnvironment` field. The router applies the request only if the subject holds a grant that allows it; otherwise the request is rejected before policy check.

---

## Caller kinds — who originated the call

`CallerKind` records the **role** of the originating actor, not its identity. Identity lives in `subject`:

| CallerKind | What it represents |
|---|---|
| `user` | A logged-in human at a UI |
| `agent` | An LLM agent running inside a session |
| `workflow` | A workflow step running on the workflow runtime |
| `app` | An external-subject session through a published app |
| `service` | Service-to-service call between platform services |
| `runner` | A runner reporting status or fetching work |

Audit rows group by caller for human-readable reports ("Who has been invoking `connector:bank.transfer@1`?" returns one row per agent, workflow, user).

---

## Sub-invocations and lineage

When an agent spawns a sub-agent, or a workflow step invokes a capability that itself invokes another, the child invocation inherits the parent context with two changes:

- A fresh `invocationId`.
- `parentInvocationId` set to the parent's `invocationId`.

Lineage queries are first-class: the Shell's `why-denied <auditId>` walks the parent chain and reports the originating subject plus the chain of capabilities that led to the denial.

---

## Why one envelope, everywhere

Before ExecutionContext, every service had its own ad-hoc bag of fields: `subjectEnvironment`, `actorRef`, `tenantId`, `auditCorrelationId`, with no shared contract. ExecutionContext collapses that into **one typed shape** that:

- The router constructs once per call.
- Policy reads to make a decision.
- The runner enforces during dispatch.
- The audit log persists verbatim.

A new field (e.g. `dataResidencyHint`) is added in exactly one place — the contract package — and every consumer picks it up via the next generated client.

---

## Related concepts

- [Spaces](./spaces.md) — the `space` field on every context.
- [Environments](./environments.md) — the `environment` field on every context.
- [Policy](./policy.md) — what reads the context to make a decision.
- [Runners](./runners.md) — what enforces `routeHints` during dispatch.
- [Capabilities](./capabilities.md) — the invocation surface every context flows through.

---

**Previous**: [← Spaces](./spaces.md)
**Next**: [Policy →](./policy.md)
