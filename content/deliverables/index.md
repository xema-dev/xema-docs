# Deliverables

> API Docs: https://deliverable-specs-api.xema.dev/api/docs

A **deliverable spec** describes what an agent must produce on a given workflow step: a multi-page document, a JSON payload, a direct response, code emitted into a working repo, or anything else with a typed contract. The deliverables framework owns the contract surface that ties workflow YAML, agent runtime, and downstream consumers together — one envelope for every kind, one canonical access path, one self-correction attempt when the agent gets it wrong.

## Quick Links

| Page | What it covers |
|---|---|
| [01 Concepts](./01-concepts.md) | The seven deliverable kinds, the `targetSlot` choice, response-only vs file-emitting |
| [02 Authoring](./02-authoring.md) | Declaring `with.deliverableSpecRef` in a workflow; literal vs expression form; matrix fan-out for variable count |
| [03 Output Envelope](./03-output-envelope.md) | The canonical `agentResult.deliverable` shape and how downstream YAML expressions read it |
| [04 Validation & Self-Correction](./04-validation-and-self-correction.md) | What kind handlers verify, structured failure payloads, and the one-shot self-correction loop |
| [Reviewer Output](./reviewer-output.md) | The review-verdict deliverable shape and how the reviewer kernel emits it |
| [Examples](./examples/index.md) | End-to-end YAML for each kind plus a mixed-kind matrix dispatch |

## Getting Started

Read in order if you're new to the framework:
1. **[Concepts](./01-concepts.md)** — what a deliverable spec is and which kind fits your job.
2. **[Authoring](./02-authoring.md)** — how to wire it up in a workflow YAML.
3. **[Output Envelope](./03-output-envelope.md)** — how downstream jobs consume it.
4. **[Validation & Self-Correction](./04-validation-and-self-correction.md)** — what happens when an agent's output is wrong, and what the user sees.

## FAQ

**Q: My job needs to produce N deliverables of different shapes (e.g. five microservices + one frontend). How?**
A: Matrix fan-out. The upstream step (typically a clarification agent) emits a typed array of build targets, and the downstream matrix job iterates one job per entry. Each iteration resolves its own `deliverableSpecRef` from the matrix entry. See [02 Authoring](./02-authoring.md) and [Examples · Matrix mixed kinds](./examples/05-matrix-mixed-kinds.md).

**Q: How do I know if validation failed?**
A: The run-detail UI renders an inline failure card on the activity span when validation fails. The card shows the typed reason, the spec contract that was expected, the actual files / response that the agent produced, and a banner indicating whether the self-correction attempt is in progress, succeeded, or also failed.

**Q: What happens when the agent hallucinates?**
A: The agent gets one structured retry inside the same agent session. The runtime sends a deterministic correction message describing exactly what failed and why, and the agent attempts to fix it without losing prior context. If the second attempt also fails, the activity throws `DELIVERABLE_CONTRACT_VIOLATED` (non-retryable) and the workflow terminates cleanly.

**Q: Can I produce code (files) into a working repo?**
A: Yes — set `targetSlot: { kind: 'repos', repoSlug: '<your-repo>' }` on the spec. The harvester writes into `repos/<slug>/` instead of the default `deliverables/` slot. Use the `custom` kind for arbitrary file lists or `document` for templated docs.
