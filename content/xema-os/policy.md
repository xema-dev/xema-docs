# Policy

A **Policy** is the protocol that turns an [ExecutionContext](./execution-contexts.md) into a decision. Every capability call in Xema OS is mediated by exactly one policy decision; that decision is the only thing the router trusts. Policies cover authorization, environment fit, data-classification matching, runner selection, and step-up requirements in one uniform shape.

---

## The decision shape

A policy decision is data, not a stack trace. The contract lives in `@xemahq/kernel-contracts/policy`:

```ts
interface PolicyDecision {
  kind:                          PolicyDecisionKind;
  reason?:                       string;                  // stable wire code from the authorization plane
  obligations?:                  readonly PolicyObligation[];
  routeHints?:                   RouteHint;
  credentialBindingId?:          string;                  // allow-only; opaque, never a secret
  credentialPrecedenceApplied?:  CredentialPrecedenceSource;
}
```

`PolicyDecisionKind` is a closed enum — three values, nothing else:

| Kind | Wire value | What the router does next |
|---|---|---|
| `Allow` | `allow` | Apply obligations, dispatch to a runner per `routeHints` |
| `Deny` | `deny` | Return a typed denial; never dispatch |
| `NeedsApproval` | `needs_approval` | Emit `approval.requested.v1`, suspend the invocation |

There is no fourth `allow_with_warning`, and `needs_approval` is never collapsed into an `allow` carrying an obligation. Either the policy permits the call, refuses it, or asks a human.

---

## Obligations — things the caller must honour

`PolicyObligation` is a **discriminated union** over a closed `PolicyObligationKind`. Policy must not emit an obligation outside this set; the boundary check rejects an unknown discriminator at runtime.

| Kind | Wire value | Effect |
|---|---|---|
| `Audit` | `audit` | The invocation must be written to the audit journal |
| `RedactSecrets` | `redact-secrets` | Secret-shaped values are redacted before the result leaves the gateway |
| `RequireRunnerKind` | `require-runner-kind` | Hard-pins the dispatch to one `RunnerKind` |
| `RequireHumanApproval` | `require-human-approval` | A human in the named approver role must approve before dispatch |
| `MaxDurationSeconds` | `max-duration-seconds` | Wall-clock ceiling for the invocation |
| `MaxCostUsd` | `max-cost-usd` | Cost ceiling for the invocation |
| `RestrictOutputClassification` | `restrict-output-classification` | Caps the [data classification](./spaces.md) the output may carry |
| `DataResidency` | `data-residency` | Restricts dispatch to runners in the named residency class |
| `EgressAllowlist` | `egress-allowlist` | Wildcard host/URL patterns the executing party may reach on an outbound fetch, with an optional subtractive blocklist |

`EgressAllowlist` is deliberately generic — it is not mail-specific. Every biome's outbound-fetch path consults it, through one shared matcher rather than an ad-hoc string compare.

`DataResidency` is its own closed set, and it has exactly **one** member:
`customer-private` — the customer-edge tenancy class used when an org runs its own
runner in a private network. A decision carrying anything else is refused by the
router rather than dispatched.

It shrank to one member on purpose. `eu` and `us` were members once, and they were
not merely unused: the runner selector's residency filter answered `false` for
anything but `customer-private`, so either of them would have emptied the candidate
pool and failed every dispatch. The obligation could name a region that nothing on
the other side could satisfy, because **no region→residency registry existed**.

That registry exists now, and it is deliberately *not* this enum. A residency is
**declared on an [execution target](./runners.md#execution-targets)** — the pool of
executors that actually has the property — under the well-known label key
`residency`. Declared there, a residency claim is enforceable because the target
has its own task queue, polled by the operator's own worker, on the operator's own
hardware; it is not enforceable by comparing two strings.

The division is the general rule and worth keeping: a region is an **open**
vocabulary owned by whoever runs the machines, and an obligation kind is a
**closed** vocabulary owned by the kernel. Putting regions in the second is what
produced two members nothing could satisfy. Do not add a region member here — add a
target.

There is no MFA obligation and no expiry obligation.

---

## Route hints — selecting a runner

`RouteHint` is the structured directive a decision uses to constrain runner selection. It is one optional object on the decision, not a list.

```ts
interface RouteHint {
  requiredRunnerLabels?: Record<string, string>;  // AND semantics — every key must match
  preferredRunnerKind?:  RunnerKind;              // SOFT: the router may fall back
  requiredRegion?:       string;                  // HARD: e.g. 'eu-west'
  requireCustomerEdge?:  boolean;                 // HARD: only customer-edge runners
}
```

Two properties are easy to get backwards:

- **`preferredRunnerKind` is a preference, not a constraint.** The router may fall back to another kind if the preferred one is unavailable — *unless* a `require-runner-kind` obligation hard-pins it. The obligation is the hard form; the hint is the soft one.
- **Labels only narrow.** They never establish ownership, trust, locality or capability authority. A label cannot grant anything.

`requireCustomerEdge` is equivalent to a `data-residency=customer-private` obligation expressed at the routing layer. The router respects both.

If no runner survives the filters, the invocation fails fast with `NO_RUNNER_AVAILABLE` (`CapabilityErrorCode.NoRunnerAvailable`), and the error names the constraint that eliminated the last candidate. There is no implicit fallback to a less-restrictive runner.

---

## Credential selection is part of the decision

When a capability declares an external service, the decision also carries the **credential binding** the gateway must use — `credentialBindingId`, plus `credentialPrecedenceApplied` recording which tier supplied it.

The PDP is the single authority for that choice, applying a fixed ladder, highest wins:

```
explicit grant  >  capability default  >  user default
                >  project default  >  org default  >  system default  >  none
```

`credentialPrecedenceApplied` records which rung answered, as a
`CredentialPrecedenceSource` — `Explicit`, `CapabilityDefault`, `UserDefault`,
`ProjectDefault`, `OrgDefault`, `PlatformDefault`. The user rung is what makes
"the agent acts on my behalf" mean *with my credential*.

**The ladder is keyed by (provider, subject, space), and the provider half is
load-bearing.** The provider is derived from the capability ref itself — for a
`connector:` ref it is the resource segment, for anything else the domain — so a
default is per-provider, never one binding standing in for GitHub, Slack and
Jira at once. A ref the platform cannot derive a provider from skips the four
default rungs entirely rather than matching loosely.

**Reaching the bottom rung is not a denial.** It returns *no binding*, and a
capability that needs no external credential proceeds normally — most do. The
denial for a capability that genuinely requires a credential comes later, from
the broker, when there is nothing to resolve. There is no silent fallback in
either direction: the ladder never guesses a binding, and never substitutes a
wider owner's when a narrower one was named.

The router forwards only the opaque id, never a secret, and the broker re-validates it before reading custody.

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
    ├─ Layer 2: ABAC — do the attribute rules for the active environment allow it?
    │             (Space classification, environment reach ceiling, risk tier)
    │
    └─ Layer 3: Obligations + RouteHints — what must the caller honour?
                                 │
                                 ▼
                         PolicyDecision
```

Layer 1 is grant-based; Layer 2 is rule-based; Layer 3 attaches durable constraints to the allow.

---

## Structured denials

Every denial carries a stable `reason` code. The Shell's `why-denied <auditId>` returns the full decision:

```jsonc
{
  "kind": "deny",
  "reason": "MISSING_GRANT",
  "obligations": [],
  "routeHints": {}
}
```

Reason codes are stable wire strings owned by the authorization plane, drawn from a closed set rather than composed as prose: the frontend renders human-readable copy from the code, and an agent matches structurally against the code to self-correct.

---

## Approval flow — `needs_approval`

Some capabilities require explicit human approval before dispatch. The flow:

1. Policy returns `kind: needs_approval`, with a `require-human-approval` obligation naming the approver role.
2. The router suspends the invocation and emits `approval.requested.v1` on the event hub.
3. An approver reviews and approves or rejects.
4. Approval → the router re-dispatches with the original `ExecutionContext`.
5. Rejection → a final denial.

The capability never executes between request and approval. The original invocation is durable, so the approval surface can resume it cleanly across router restarts.

---

## Environment policies

An organization tightens what runs where by authoring a custom [execution environment](./environments.md), or by capping a built-in's data-classification ceiling for itself. Tightening is the only direction available: an environment's reach ceiling and classification ceiling can turn an allow into a deny, never the reverse.

---

## Related concepts

- [Execution contexts](./execution-contexts.md) — the input shape every policy reads.
- [Environments](./environments.md) — the reach and classification ceilings Layer 2 consults.
- [Runners](./runners.md) — route hints and the `require-runner-kind` obligation constrain runner selection.
- [Capabilities](./capabilities.md) — every call is policy-mediated.
- [Spaces](./spaces.md) — data classification flows from Space into policy.

---

**Previous**: [← Execution Contexts](./execution-contexts.md)
**Next**: [Permissions & Access →](./permissions.md)
