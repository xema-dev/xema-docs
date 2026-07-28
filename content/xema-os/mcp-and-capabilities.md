# MCP and Capabilities

External agents reach Xema through the Model Context Protocol (MCP). External tool servers (GitHub MCP, Slack MCP, third-party MCP servers an org installs) also speak MCP. Xema unifies both directions under **one surface**: every external MCP tool becomes a Xema [capability](./capabilities.md), and every agent — whether it lives inside Xema or talks to Xema over MCP — sees the same six meta-tools.

This is the bridge between the agent ecosystem's wire protocol and Xema's typed, policy-mediated capability plane.

---

## The agent's view: six meta-tools, no proliferation

An agent connected to Xema does **not** see N separate MCP servers, one per integration. It sees exactly six tools:

| Meta-tool | Purpose |
|---|---|
| `xema.capabilities.search` | Find the capabilities the agent is allowed to invoke right now |
| `xema.capabilities.describe` | Get the input/output schema, examples, and side effects for one or more refs |
| `xema.capabilities.invoke` | Invoke a capability by ref |
| `xema.capabilities.plan` | Derive the shortest runnable sequence of capabilities to reach a goal |
| `xema.capabilities.preflight` | Report what blocks an invocation — before the call fails |
| `xema.capabilities.explain` | Turn a denial into the grant that would unlock it |

This collapses the agent's surface from "one tool per provider verb across every installed integration" (dozens to hundreds) to **six tools, always** — and, crucially, keeps it constant as the capability catalogue grows. The results returned by `search` are the agent's working set: filtered by Subject, Space, Environment, and Policy, so the agent never sees what it cannot invoke.

### `xema.capabilities.search`

Finds the capabilities the agent may invoke under the current [ExecutionContext](./execution-contexts.md).

Search is **anchored, not exhaustive**. Naming a resource type — explicitly, or as a noun in `query` — enters the [capability graph](./capabilities.md) at that type and returns its neighbourhood: the actions that act on it, plus those one containment hop below. That is what keeps discovery a constant-cost operation whether the org has installed forty capabilities or forty thousand. Without an anchor, search returns a bounded, ranked page of the catalogue.

There is no full-catalogue listing. Page through results with `cursor`.

```jsonc
// Input — every field optional
{ "query": "open a pull request", "domain": "connector", "limit": 20 }

// Output
{
  "capabilities": [
    {
      "ref":      "connector:scm.create-pull-request@1",
      "biome":    { "id": "xema.software-dev", "version": "1.4.0" },
      "title":    "Open a pull request",
      "summary":  "Creates a PR on the project's bound SCM provider.",
      "riskTier": "medium",
      "requiresApproval": false,
      "mutation": "mutating",
      "relation": "acts_on",
      "distance": 0
    },
    { "ref": "connector:tracker.issue.create@1", "...": "..." }
  ],
  "anchor":          { "resourceType": "scm", "source": "derived-from-query" },
  "consideredCount": 34,
  "nextCursor":      "eyJ2IjoxLCJvIjoyMH0"
}
```

Filtering happens server-side, and a capability the agent may not invoke is **absent** — not returned with a denial marker. An agent in a `public-app` environment never sees `connector:bank.transfer@1` even if some other subject can invoke it. Compare `consideredCount` with the number of results to see how much authorization removed.

### `xema.capabilities.describe`

Returns full schemas, examples, side-effect labels, and approval requirements:

```jsonc
// Input
{ "refs": ["connector:scm.create-pull-request@1"] }

// Output
{
  "items": [
    {
      "ref":            "connector:scm.create-pull-request@1",
      "inputSchema":    { /* JSON Schema */ },
      "outputSchema":   { /* JSON Schema */ },
      "examples":       [ { "input": {...}, "output": {...} } ],
      "sideEffects":    ["writes-external-system"],
      "requiresApproval": false,
      "biome":          { "id": "xema.software-dev", "version": "2.4.1" }
    }
  ]
}
```

Describe accepts arrays so an agent fetching context can batch-resolve every capability it plans to use in one call.

### `xema.capabilities.invoke`

Generic invocation:

```jsonc
// Input
{ "ref": "connector:scm.create-pull-request@1", "input": { "repo": "...", "branch": "...", "title": "..." } }

// Output
{
  "output":      { "url": "https://github.com/acme/web/pull/123" },
  "auditId":     "inv_abc",
  "obligations": [],
  "decision":    "allow"
}
```

Validation runs at invoke-time against the same schema `describe` returns. Bad input is rejected at the router boundary before any runner touches it.

---

## External MCP servers — federation as capability providers

When an org admin registers an external MCP server (a GitHub MCP, a Slack MCP, a third-party domain MCP), the platform's MCP bridge:

1. **Calls `tools/list`** on the external server at registration time.
2. **Translates each tool** to a Xema capability ref using the closed grammar `<provider-id>:<tool-name>@1` (e.g. `github-mcp:create-issue@1`).
3. **Registers each capability** through the [Service Registry](./service-registry.md) with runner kind `mcp-external` and the external server as its endpoint.
4. **Lints the manifest** so policy authors and admins can attach permission digests and obligations exactly as they would for a first-party capability.

From that point forward, the external tool is **indistinguishable** from a native Xema capability:

- Every invocation routes through the capability router.
- Every call is authorized by `authorization-api` against the org's grants.
- Every input/output is validated against the schema the external server published.
- Every result lands in the audit log with the full ExecutionContext.

The agent **never** sees the external MCP server as a separate tool list. It sees one result in `xema.capabilities.search`, with the same shape as every other capability.

---

## Why one surface

Three forces converge here:

- **Agent UX** — a tool list that grows linearly with installed integrations becomes unusable. Six meta-tools stay constant, and anchored search keeps the cost of *finding* the right one constant too.
- **Authorization** — every invocation crosses the same trust boundary, so it must read the same `ExecutionContext`. A direct-MCP escape hatch would bypass policy.
- **Auditability** — one capability invocation = one audit row, regardless of whether the implementation is a first-party connector or an external MCP server.

The federation bridge handles the wire-protocol translation. The Xema-native capability surface handles policy, audit, and dispatch. Agents see the unified result.

---

## Discovery, not memorization

Agents are taught — in their system skill — to **discover** capabilities at the start of each turn, not to hardcode tool names from training data. The recommended pattern:

```
On each new task:
1. Call xema.capabilities.search, naming the resource you are acting on
   (e.g. resourceType: "project") or describing the goal in `query`.
2. Pick the capability whose summary matches the goal.
3. Call xema.capabilities.describe to see the schema.
4. Call xema.capabilities.invoke with valid input.

For work that takes several dependent steps, call xema.capabilities.plan
with the goal ref instead of guessing the order. Before an action that
needs a connection or a grant, call xema.capabilities.preflight. If an
invocation is refused, call xema.capabilities.explain with the denial
code rather than retrying unchanged.
```

This means a freshly installed biome's new capabilities appear to the agent **immediately** — no agent prompt redeployment, no skill bundle refresh, no training cycle.

---

## What this replaces

Before unification:

- Agents saw a separate MCP "server" entry per integration (GitHub-MCP, Slack-MCP, Linear-MCP…).
- Each MCP tool was a distinct OpenAI/Anthropic-style tool definition in the agent's context window.
- Capability boundaries between providers were enforced only at the runner layer, never in the agent's view of "what exists".
- Adding a new integration meant updating agent skill bundles and rotating prompts.

After unification:

- One tool list, always three entries.
- The capability list updates in real time as biomes install/uninstall.
- Policy is the only thing that decides what an agent can see.
- No prompt rotations on integration change.

---

## Related concepts

- [Capabilities](./capabilities.md) — the underlying invocation surface.
- [Execution contexts](./execution-contexts.md) — what each meta-tool reads to filter.
- [Policy](./policy.md) — what the capability router consults at invoke time.
- [Service registry](./service-registry.md) — where external MCP servers register as capability providers.
- [Skills](./skills/) — agents learn discovery patterns via system skills.

---

**Previous**: [← Service Registry](./service-registry.md)
**Next**: [Developer Annotations →](./developer-annotations.md)
