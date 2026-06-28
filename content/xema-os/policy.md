# Policy

A **Policy** is the protocol that turns an [ExecutionContext](./execution-contexts.md) into a decision. Every capability call in Xema OS is mediated by exactly one policy decision; that decision is the only thing the runner trusts. Policies cover authorization, environment-fit, data-classification matching, runner selection, and step-up requirements (MFA, approval, residency pinning) in one uniform shape.

---

## The decision shape

A policy decision is data, not a stack trace. The contract lives in `@xemahq/policy-contracts`:

```ts
interface PolicyDecision {
  kind:        PolicyDecisionKind;   // 'allow' | 'deny' | 'needs_approval'
  reasons:     PolicyReason[];       // structured causes (closed enum codes)
  obligations: PolicyObligation[];   // things the caller MUST do
  routeHints:  RouteHint[];          // runner / region / residency constraints
  ttlSeconds?: number;               // cache lifetime; default 60s for allow, 0 for deny
  auditId:     string;
}
```

`PolicyDecisionKind` is a closed enum — three values, nothing else:

| Kind | Meaning | What the router does next |
|---|---|---|
| `allow` | The call may proceed | Apply obligations, dispatch to a runner per `routeHints` |
| `deny` | The call must not proceed | Return a typed denial; never dispatch |
| `needs_approval` | A human must approve before dispatch | Emit `approval.requested.v1`, suspend invocation |

There is no fourth `allow_with_warning`. Either the policy permits the call or it does not.

---

## Obligations — things the caller must do

`PolicyObligation` is a closed set. Each obligation is one declarative directive the router and/or runner is required to honor:

| Obligation | Effect |
|---|---|
| `MaskField` | The named field in the response is masked before returning to the caller |
| `RedactInAudit` | The named field is redacted in the audit-log entry |
| `RequireMfa` | The subject must have completed MFA within the last N seconds |
| `RequireApproval` | A human approver from the named role must approve before dispatch |
| `BindRunnerLabels` | Restrict dispatch to runners carrying these labels |
| `BindRegion` | Restrict dispatch to runners in the named region |
| `BindResidency` | Restrict dispatch to runners with the named data-locality |
| `RateLimit` | Apply the named rate-limit bucket to this subject |
| `ExpireAt` | The grant supporting this allow expires at the named timestamp |

Obligations are **enforced**, not advisory. An `allow` with an unhonoured obligation is treated as a deny by the audit layer.

---

## Route hints — selecting a runner

`RouteHint` is the structured directive a policy decision uses to constrain runner selection. Route hints are derived from the policy itself plus the calling subject's `BindRunnerLabels` / `BindRegion` / `BindResidency` obligations.

```ts
interface RouteHint {
  requiredRunnerKind?: RunnerKind;     // 'embedded' | 'local-module' | 'remote'
  requiredLabels?:     Record<string, string>;   // runner must carry every label
  requiredRegion?:     string;          // e.g. 'eu-west'
  requiredResidency?:  DataLocality;    // 'cloud' | 'customer-private' | 'on-prem'
  excludeRunners?:     string[];        // explicit deny-list (e.g. quarantined runner)
}
```

The router picks the first registered runner that satisfies every active hint. If no runner qualifies, the invocation fails fast with `NO_RUNNER_MATCHES_POLICY` — there is no implicit fallback to a less-restrictive runner.

Worked example: `connector:bank.transfer@1` in a `finance-production` environment with `BindResidency=customer-private` + `BindRegion=eu-west` selects only runners labelled `dataLocality=customer-private` AND `region=eu-west`. Cloud runners are never chosen, even if available.

---

## Where the decision comes from

`authorization-api` is the authoritative source. It composes the decision from three layers:

```
ExecutionContext
    │
    ▼
authorization-api.policyCheck(context)
    │
    ├─ Layer 1: ReBAC — is the subject in a relation that grants this?
    │             (membership, ownership, role assignment, install grant)
    │
    ├─ Layer 2: ABAC — does the policy bundle for the active environment allow it?
    │             (Space classification, time-of-day, region, MFA freshness)
    │
    └─ Layer 3: Obligations + RouteHints — what must the caller honour?
                  (mask, redact, require MFA, bind runner labels)
                                 │
                                 ▼
                         PolicyDecision
```

Layer 1 is grant-based; Layer 2 is rule-based; Layer 3 attaches durable constraints to the allow.

The decision is cached per `(subject, capability, space, environment)` tuple with a default 60-second TTL. Cache invalidation is event-driven via `authorization.grant.changed.v1` and `authorization.environment.changed.v1` CloudEvents — there is no time-based-only invalidation.

---

## Structured denials

Every denial carries an `auditId`. `xema why-denied <auditId>` returns the full decision:

```jsonc
{
  "auditId": "deny_xyz123",
  "kind": "deny",
  "reasons": [
    {
      "code": "MISSING_GRANT",
      "detail": "connector:scm.create-pull-request@1 is not granted to agent:support-bot in environment 'public-app'"
    },
    {
      "code": "CLASSIFICATION_FLOOR_VIOLATION",
      "detail": "Output is classified Confidential; target Space is classified Public"
    }
  ],
  "obligations": [],
  "routeHints": [],
  "suggestions": [
    { "kind": "request-grant", "capability": "connector:scm.create-pull-request@1", "environment": "app" },
    { "kind": "switch-environment", "from": "public-app", "to": "project" }
  ]
}
```

Reason codes are a closed enum; the FE renders human-readable copy from the code, the agent matches structurally against the code to self-correct.

---

## Approval flow — `needs_approval`

Some capabilities are configured to require explicit human approval before dispatch. The flow:

1. Policy returns `kind: needs_approval` with the required approver role in `obligations`.
2. The router suspends the invocation and emits `approval.requested.v1` on the event hub.
3. An approver (a human, never an agent unless the approver role explicitly permits it) reviews and approves or rejects through the Approvals UI.
4. Approval → router re-dispatches with the original `ExecutionContext` plus the approver's identity recorded as an obligation `ApprovalGranted{ by, at }`.
5. Rejection → final denial with the rejector's identity.

The capability never executes between request and approval. The original invocation is durable on the event hub; the approval surface can resume it cleanly even across router restarts.

---

## Custom environment policies

Orgs may compose custom environments (see [Environments](./environments.md)) by **tightening** the policy of an inherited template. Tightening adds obligations and restrictions; weakening (removing obligations from a stricter parent) is rejected by the policy compiler.

This means an org can author a `finance-production` environment that adds `RequireMfa` + `BindResidency=customer-private` on top of the built-in `org` template — and be confident no biome can ever weaken those obligations by re-binding the capability elsewhere.

---

## Related concepts

- [Execution contexts](./execution-contexts.md) — the input shape every policy reads.
- [Environments](./environments.md) — environment policies are the rule bundle Layer 2 consults.
- [Runners](./runners.md) — route hints constrain runner selection.
- [Capabilities](./capabilities.md) — every call is policy-mediated.
- [Spaces](./spaces.md) — data classification flows from Space into policy.

---

**Previous**: [← Execution Contexts](./execution-contexts.md)
**Next**: [Permissions & Access →](./permissions.md)
