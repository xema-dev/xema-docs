# Groups

A **group** is a named, addressable set of users. Groups are how teams encode who-does-what once and reuse it across workflows: instead of hard-coding a `userId` in YAML, address `Security Champions` or `On-Call Engineers`.

Groups are an identity primitive. They live alongside users and organizations, support nested membership, and propagate to every consumer that needs a list of people.

---

## Authoring a group

Groups can be created from the org settings UI or via the platform API. Each group has:

- **Name** — `lowercase-kebab-case`, unique within the parent (org or another group).
- **Parent** — optional. Top-level groups are siblings of the organization itself; nested groups are subgroups of an existing group.
- **Attributes** — free-form `Map<string, string[]>` for tags like `purpose=approval-rota`, `region=eu`, etc. Consumers tag groups for their own filters.

Members are users, identified by their stable user id. A user can belong to many groups; a group can nest other groups.

---

## Addressing a group from a workflow

Use the `identity-group` recipient kind to target every human member of a group, including all descendants:

```yaml
- name: security-review
  uses: xema/decision-gate
  with:
    title: "Security sign-off required"
    recipients:
      - kind: identity-group
        target:
          groupId: ${{ vars.SECURITY_CHAMPIONS_GROUP_ID }}
          # Default: fail inquiry creation if the group has no members.
          # Set true if an empty group is acceptable.
          allowEmpty: false
    policy:
      kind: m_of_n
      m: 2
```

When the inquiry is created, Xema resolves the group recursively to its current members and replaces the group recipient with N concrete `human` recipients. The inquiry's audit trail records who was asked, with an immutable snapshot of membership at creation time.

---

## Snapshot semantics, again

It bears repeating: group resolution is **snapshot-at-create**. If you add Eduardo to `security-champions` *after* an inquiry is raised, that inquiry will not start asking Eduardo. New inquiries will see the new membership; existing ones won't be retroactively re-targeted.

This is by design — workflows are deterministic, audits are stable, and "who has the approval?" never has a moving answer.

---

## Mixing groups and individuals

A `recipients[]` list can mix kinds freely. The engine de-duplicates by user id so a person mentioned both directly and via a group only gets one recipient row:

```yaml
recipients:
  - kind: identity-group
    target:
      groupId: ${{ vars.SECURITY_CHAMPIONS_GROUP_ID }}
  - kind: human
    target:
      userId: ${{ trigger.user.id }}    # always include the requester
  - kind: agent
    target:
      agentRef: compliance-reviewer
```

If `${{ trigger.user.id }}` is already a security champion, they appear once.

---

## Group cardinality

There's no hard cap on group membership but the inquiry's reply policy is the right place to bound expectations. A group of fifty under a `single` policy means whoever answers first wins; under `all_of` means every member must reply. Use `m_of_n` for "any 2 of 5 champions" patterns.

---

## Failure modes

The engine fails fast at inquiry-create time:

- **Group not found** — `INQUIRY_GROUP_NOT_FOUND`. The `groupId` is wrong or you don't have access.
- **Empty after expansion** — `INQUIRY_GROUP_EMPTY`. Set `allowEmpty: true` to accept this case (useful for fallback notification lists), or fix the group.
- **Identity service unreachable** — bubbles up. Workflows retry per their retry policy; there is no silent empty-recipient fallback.

These are explicit, structured errors so authors get a clear signal at create time rather than a silently stuck workflow.

---

**Previous**: [← Recipients](./02-recipients.md)
