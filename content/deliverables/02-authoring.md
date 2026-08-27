# Authoring deliverables in workflows

A workflow job becomes "deliverable-producing" the moment it sets `with.deliverableSpecRef`. There's no second declaration — that one field is the contract.

---

## Literal form

```yaml
jobs:
  requirements:
    uses: xema/agent
    with:
      agentRef: requirements
      deliverableSpecRef: requirements-standard
      agentContext:
        prompt: ${{ inputs.request }}
```

The compiler resolves the spec ref against the registry at compile time. A typo or a missing spec fails with `DSL_UNKNOWN_DELIVERABLE_SPEC` — fast, clear, no runtime surprise.

## Expression form

When the spec depends on runtime data — typically a clarification step's output — author the ref as a `${{ … }}` expression.

```yaml
jobs:
  build:
    needs: [clarify]
    strategy:
      dynamic:
        from: ${{ needs.clarify.outputs.targets }}
        as: target
        keyBy: name
        maxEntries: 32
    uses: xema/agent
    with:
      agentRef: builder
      deliverableSpecRef: ${{ target.specRef }}
      agentContext:
        prompt: ${{ target.prompt }}
```

The ref resolves at dispatch time, when the matrix iteration's binding is materialized. The runtime fetches the spec, validates the harvest, and surfaces the canonical envelope.

Authors who supply expression-shaped refs accept that the compiler can't pre-validate the ref — the runtime fail-fasts on unknown specs with a typed `RENDER_FAILED` error naming the offending value.

## Variable count, mixed kinds

The matrix mechanism is the single answer to "produce a different number of deliverables based on user intent." The upstream clarification step decides how many targets the user asked for, of which kinds, and emits a typed array. Each matrix iteration:

- Resolves its own `deliverableSpecRef` from the matrix entry.
- Drives its own agent session with the entry's prompt.
- Harvests + validates against that spec.
- Surfaces its result under `byKey[<name>].deliverable.content.<...>` for downstream jobs.

```yaml
clarify:
  uses: xema/agent
  with:
    agentRef: clarification-coordinator
    deliverableSpecRef: handoff-package
    agentContext:
      prompt: Clarify the request and emit a typed handoff package.
  outputs:
    targets: ${{ job.outputs.deliverable.content.value.targets }}

build:
  needs: [clarify]
  strategy:
    dynamic:
      from: ${{ needs.clarify.outputs.targets }}
      as: target
      keyBy: name
  uses: xema/agent
  with:
    agentRef: builder
    deliverableSpecRef: ${{ target.specRef }}
    agentContext:
      prompt: ${{ target.prompt }}
```

A user asking for "five microservices and one frontend" produces a clarification output with six targets (five `specRef: microservice-template`, one `specRef: frontend-template`). The matrix expands to six concurrent agent runs. Zero deliverables = empty array = zero iterations.

## What you don't need to declare

- No output-key mapping. Workflow expressions read `deliverable.content.<...>` directly.
- No validation flag on the producing job. Validation is a job of its own — add `xema/validate-deliverables` downstream when you want a verdict to gate on. See [04 Validation](./04-validation.md).

## Action version

```yaml
uses: xema/agent@2.1.0
```

---

**Previous**: [← Concepts](./01-concepts.md)
**Next**: [Output Envelope →](./03-output-envelope.md)
