# Deliverables

> API Docs: https://deliverable-specs-api.xema.dev/api/docs

A **deliverable spec** describes what an agent must produce on a given workflow step: a multi-page document, a JSON payload, a direct response, code emitted into a working repo, or anything else with a typed contract. The deliverables framework owns the contract surface that ties workflow YAML, agent runtime, and downstream consumers together — one envelope for every kind, one canonical access path, and one server-side validator every workflow can branch on.

## Quick Links

| Page | What it covers |
|---|---|
| [01 Concepts](./01-concepts.md) | The seven deliverable kinds, the `targetSlot` choice, response-only vs file-emitting |
| [02 Authoring](./02-authoring.md) | Declaring `with.deliverableSpecRef` in a workflow; literal vs expression form; matrix fan-out for variable count |
| [03 Output Envelope](./03-output-envelope.md) | The canonical `agentResult.deliverable` shape and how downstream YAML expressions read it |
| [04 Validation](./04-validation.md) | Harvest-time discovery, the `xema/validate-deliverables` action, issue codes, and branching on the verdict |
| [Reviewer Output](./reviewer-output.md) | The review-verdict deliverable shape and how the reviewer kernel emits it |
| [Examples](./examples/index.md) | End-to-end YAML for each kind plus a mixed-kind matrix dispatch |

## Getting Started

Read in order if you're new to the framework:
1. **[Concepts](./01-concepts.md)** — what a deliverable spec is and which kind fits your job.
2. **[Authoring](./02-authoring.md)** — how to wire it up in a workflow YAML.
3. **[Output Envelope](./03-output-envelope.md)** — how downstream jobs consume it.
4. **[Validation](./04-validation.md)** — how a produced deliverable is checked against its spec, and how a workflow reacts.

## FAQ

**Q: My job needs to produce N deliverables of different shapes (e.g. five microservices + one frontend). How?**
A: Matrix fan-out. The upstream step (typically a clarification agent) emits a typed array of build targets, and the downstream matrix job iterates one job per entry. Each iteration resolves its own `deliverableSpecRef` from the matrix entry. See [02 Authoring](./02-authoring.md) and [Examples · Matrix mixed kinds](./examples/05-matrix-mixed-kinds.md).

**Q: How do I know if validation failed?**
A: Add an `xema/validate-deliverables` job downstream of the producing job. It returns `verdict: pass | warn | fail` plus an `issues[]` array, and both are ordinary job outputs — read them from an `if:` gate, publish them, or forward them. See [04 Validation](./04-validation.md).

**Q: What happens when the agent produces the wrong thing?**
A: Nothing terminates on its own. The harvester records warnings and returns no structured value; `xema/validate-deliverables` returns `verdict: fail` and the job still succeeds. What a failing verdict means is a decision the workflow author writes — publish an issues report, gate the next job, or run a second producing job with `issues[]` as input.

**Q: Can I produce code (files) into a working repo?**
A: Yes — set `targetSlot: { kind: 'repos', repoSlug: '<your-repo>' }` on the spec. The harvester writes into `repos/<slug>/` instead of the default `deliverables/` slot. Use the `custom` kind for arbitrary file lists or `document` for templated docs.
