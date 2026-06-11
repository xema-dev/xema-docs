# Workspace Manifest Concepts

A **Workspace Manifest** declares the complete environment an agent operates in — repos, knowledge-base spaces, deliverable specs, seed files, and agent identity — as a typed, versioned YAML document.

---

## The Workspace Image

Before an agent writes a single line of code the platform assembles a **Workspace Image**: every file, directory, and environment variable the agent will see is placed into `/workspace/` inside the agent's container. Nothing arrives by surprise; nothing is written by ad-hoc scripts.

```
/workspace/
├── AGENTS.md               ← rendered for the agent's role and phase
├── context.json            ← invocation identity (session, run, job)
├── inputs/                 ← structured inputs passed at dispatch
├── uploads/            ← files the user attached to the session
├── references/
│   ├── kb/                 ← knowledge-base spaces (read-only)
│   └── external-projects/  ← referenced repos (read-only)
├── repos/                  ← work repos (read-write)
├── deliverable-specs/      ← output contracts (read-only)
└── deliverables/           ← agent output (read-write, harvested)
```

The manifest author declares *what goes where*; the platform resolves the content from authoritative services (LLM registry, knowledge-base, artifact store, SCM integration) and writes it atomically via a typed mount plan. The operation is idempotent: applying the same manifest twice on the same worker is a no-op.

---

## Scope Hierarchy

Manifests compile into agent compositions, and agent compositions follow a five-tier precedence ladder. When a session or job resolves a composition by slug, the platform returns the most specific match:

| Tier | Who owns it | Override priority |
|---|---|---|
| `user` | A single user, authored in the Agent Studio | Highest — overrides all |
| `project` | Project owner | Overrides org, biome, and system |
| `org` | Org owner | Overrides biome and system |
| `biome` | Biome author, seeded at install | Overrides system |
| `system` | Xema platform (kernel-shipped) | Lowest |

The same ladder applies to skills, tools, and agent definitions — a single ownership model across all four runtime primitives. To customise a system or biome manifest for your org, author an org-scoped agent composition in the Agent Studio (or ship an org-scoped biome) with the same slug; the higher-tier row takes precedence immediately — no redeployment needed.

---

## How Manifests Are Applied

1. The session or workflow job references an environment by `slug` (or `slug@version`) — either via the `workspace-manifest@v1` DSL contract or directly as an agent composition via `agent-composition@v1`.
2. The platform resolves the composition through the five-tier scope ladder (user → project → org → biome → system).
3. Variable bindings (`${input.x}`) are substituted with the caller-supplied inputs.
4. A typed workspace mount plan is compiled from the composition spec.
5. The mount plan is applied to the agent's worker before any prompt is sent.
6. Seed files are rendered from named Handlebars templates (served by the skill registry as skill-bundle resources) and written to their declared paths.
7. Environment variables declared in `spec.env` are injected.
8. The agent's AGENTS.md and context.json are rendered for the specific role and phase.

The mount plan carries an idempotency key derived from the composition slug, version, and bind inputs. A warm worker that already has the same image applied gets a cache hit and skips re-application.

---

## Manifest vs. Other DSL Concepts

| Concept | Answers the question |
|---|---|
| **Workflow** | *What process runs?* (phases, jobs, gates, triggers) |
| **Deliverable Spec** | *What does the agent produce?* (output contract, schema) |
| **Workspace Manifest** | *What does the agent see?* (environment, files, tools) |

These three are sibling concepts: orthogonal, authored the same way, version-tagged, and composable.

---

**Next**: [Authoring →](./02-authoring.md)
