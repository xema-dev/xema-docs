# Model Resolution

The **Model Resolution Matrix** picks the LLM model for each composition node at invocation time. It replaces hardcoded model assignments with a declarative rule table that selects based on multiple dimensions — agent identity, active skill, project, and phase — using a "most dimensions matched wins" algorithm.

---

## Why a matrix?

Different nodes in a composition benefit from different models. A researcher node needs broad reasoning; an editor node needs precision; a security reviewer needs a model tuned for code analysis. Hardcoding a model per agent definition is inflexible. Hardcoding a model per workflow phase is worse — it means every phase-change requires editing a map in platform code.

The Matrix externalizes this decision. Org admins configure rules; the runtime resolves them per invocation. No platform code changes needed.

---

## ModelResolutionRule

A rule is a pair: a **selector** (which invocations it matches) and a **target** (which model to use):

```ts
interface ModelResolutionRule {
  id: string;
  selector: ModelMatrixSelector;
  target: ModelRef;
  priority?: number;           // tiebreaker; higher wins; defaults to 0
}

interface ModelMatrixSelector {
  agent?: string;             // agent slug (exact match)
  skill?: string;             // active skill slug (exact match)
  project?: string;           // project ID
  phase?: string;             // workflow phase key
  // extra dimensions are carried in a free-form map:
  extra?: Record<string, string>;
}
```

**Matching rule:** among rules whose every selector dimension matches the invocation context, the rule that matches the **most dimensions** wins. Ties are broken by `priority` (higher wins). If no rule matches, the DEFAULT rule applies.

---

## The DEFAULT rule

Every org must have exactly one DEFAULT rule — a rule with an empty selector that matches every invocation. It is the fallback model for the org:

```json
{
  "id": "default",
  "selector": {},
  "target": "gpt-4o",
  "priority": 0
}
```

The platform seeds this rule when the org is created. Update it via **Org Settings → Model Matrix → Default Model**.

---

## Resolution dimensions

| Dimension | Key | Matches when |
|---|---|---|
| Agent | `agent` | The composition node references an agent with this slug |
| Skill | `skill` | The node has this skill in its effective skill set at invocation time |
| Project | `project` | The invocation is scoped to this project |
| Phase | `phase` | The workflow step is in a phase with this key |

All four dimensions are optional per rule. A rule with only `agent: "security-reviewer"` matches any invocation using that agent, regardless of project, phase, or active skill.

**Most dimensions wins** means a rule with `{ agent: "reviewer", skill: "security-review" }` beats a rule with only `{ agent: "reviewer" }` for an invocation where both apply — even if the second rule has a higher `priority`.

---

## Example matrix

```json
[
  {
    "id": "default",
    "selector": {},
    "target": "gpt-4o",
    "priority": 0
  },
  {
    "id": "security-work",
    "selector": { "skill": "security-review" },
    "target": "claude-3-5-sonnet",
    "priority": 1
  },
  {
    "id": "fast-tasks",
    "selector": { "phase": "triage" },
    "target": "gpt-4o-mini",
    "priority": 1
  },
  {
    "id": "security-triage",
    "selector": { "skill": "security-review", "phase": "triage" },
    "target": "claude-3-5-sonnet",
    "priority": 2
  }
]
```

Given an invocation with `skill=security-review, phase=triage`:

1. `security-triage` matches 2 dimensions → wins.
2. `security-work` matches 1 dimension → would be second.
3. `fast-tasks` matches 1 dimension → tied with `security-work`; broken by `priority` (both 1) then `id` (lexicographic fallback).
4. `default` matches 0 dimensions → last resort.

---

## Per-invocation override

A run-time override sits above all rules. Pass `modelOverride` at the composition node level or via the session API:

```bash
xema session start --composition my-analysis --model-override claude-3-opus
```

Overrides are audited and visible in the run record. They do not modify the Matrix.

---

## Debugging resolution

See which rule was applied to a specific invocation:

```bash
xema model-resolution explain <runId> --node <nodeSlug>
```

This prints:
- The invocation context (agent, skill, project, phase).
- All matching rules and their dimension counts.
- The winning rule and the resolved model.
- The `ResolvedModelDecision` record (also visible in the Agent Studio run debugger).

---

**Previous**: [← Concepts](./01-concepts.md)
