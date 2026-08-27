# Example: Response-Only

A direct-answer flow. The agent's closing message is the deliverable — no file is emitted, no JSON is parsed.

---

## Spec

```json
{
  "ref": "commit-review-summary",
  "kind": "response-only",
  "outputContract": {
    "title": "Commit Review Summary",
    "mode": "response-only"
  }
}
```

`response-only` specs cannot declare `files[]`, `multiPage`, or `targetSlot` — the schema rejects those fields for this mode.

## Workflow

```yaml
apiVersion: xema.dev/workflow/v1alpha1
kind: Workflow
metadata:
  name: commit-review-example
  version: 1.0.0
on:
  webhook:
    accepted_kinds: [SCM_PR_OPENED, SCM_PR_UPDATED]
permissions:
  artifacts: write
jobs:
  checkout:
    uses: software-dev/scm-checkout@1.0.0
    with:
      repoRef: ${{ trigger.payload.repoRef }}
      ref: ${{ trigger.payload.headSha }}

  review:
    needs: [checkout]
    uses: xema/agent
    with:
      agentRef: gate-reviewer-quality
      stageKey: utility
      deliverableSpecRef: commit-review-summary
      agentSession: false
      agentContext:
        prompt: ${{ format('Review the diff at {0}', trigger.payload.diffUrl) }}
        repoRef: ${{ trigger.payload.repoRef }}
        changeRequestId: ${{ trigger.payload.changeRequestId }}
        headSha: ${{ trigger.payload.headSha }}
        baseSha: ${{ trigger.payload.baseSha }}
        diffUrl: ${{ trigger.payload.diffUrl }}
    outputs:
      summary: ${{ job.outputs.deliverable.content.text }}

  post-review:
    needs: [review]
    uses: software-dev/scm-post-review@1.0.0
    with:
      changeRequestId: ${{ trigger.payload.changeRequestId }}
      body: ${{ needs.review.outputs.summary }}
```

## Reading the result

```ts
agentResult: {
  deliverable: {
    specRef: 'commit-review-summary',
    kind: 'response-only',
    targetSlot: { kind: 'deliverables' },  // unused for response-only
    content: {
      kind: 'response',
      text: '## Commit Review\n\n- Looks good overall\n- Minor: prefer const for line 42...',
    },
  },
}
```

`deliverable.content.text` carries the agent's closing assistant message verbatim. Downstream `scm-post-review` posts it as a PR comment.

## Validating the result

A `response-only` spec with no `content` accepts free-form text, so there is no shape to check — the spec author's prompt is what elicits the right response.

A `response-only` spec that *does* carry `content` is different: `content` must be a JSON Schema object, and it is enforced at inference time. The activity passes it to the runtime as `outputFormat: { type: 'json_schema', schema }` so the structured-output tool validates the answer as the agent produces it, rather than after the fact.

Either way, `xema/validate-deliverables` downstream still gives the workflow a verdict to branch on — for a response-only spec its built-in rules are the artifact-count rules. See [04 Validation](../04-validation.md).

---

**Previous**: [← Code into a repo](./03-code-into-repo.md)
**Next**: [Matrix mixed kinds →](./05-matrix-mixed-kinds.md)
