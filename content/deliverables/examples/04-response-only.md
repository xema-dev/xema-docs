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
    uses: xema/agent@1.1.0
    with:
      agentSlug: gate-reviewer-quality
      role: gate-reviewer
      phaseKey: utility
      deliverableSpecRef: commit-review-summary
      agentSession: false
      mounts:
        repos: { mode: read-only }
        deliverable-specs: true
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
    selfCorrectionAttempted: false,
  },
}
```

`deliverable.content.text` carries the agent's closing assistant message verbatim. Downstream `scm-post-review` posts it as a PR comment.

## What validation catches

- Agent finished the session with empty / whitespace-only text → `EMPTY_RESPONSE`. Self-correction sends "your previous attempt produced no closing message; please respond with the review summary."

That's the only check. Response-only specs trust the spec author to write a prompt that elicits the right shape of response.

---

**Previous**: [← Code into a repo](./03-code-into-repo.md)
**Next**: [Matrix mixed kinds →](./05-matrix-mixed-kinds.md)
