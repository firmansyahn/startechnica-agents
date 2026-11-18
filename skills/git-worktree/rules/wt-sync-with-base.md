---
title: Merge the base into the worktree at four fixed points
impact: MEDIUM
tags: worktree, merge, base, sync
check: review
---

## Merge the base into the worktree at four fixed points

**Impact: MEDIUM** (a branch that is days behind meets every conflict at once, in the MR, when it is hardest to resolve)

Conflicts grow with the age of the gap between a branch and its base (`wt-know-the-base`). Merge the base into the worktree at four points: when the worktree is made (fetch first, and cut it from the fetched base), whenever another worktree's MR merged into that base, before opening the MR, and before asking for the merge. Keep the branch small and short-lived: one concern per MR. With `rerere` on (section 4 of this skill), a conflict resolved in one worktree is reapplied in the others.

**Incorrect:**

```sh
# worktree made on Monday; the base is first merged on Friday, when the MR already shows conflicts
git merge origin/develop
```

**Correct:**

```sh
git fetch origin && git merge origin/develop    # at the start, after a sibling merged, before the MR, before the merge
git diff --name-only --diff-filter=U            # any conflict is small and still fresh
```

**How to check:** in review, `git log --oneline HEAD..origin/<base>` is empty, or lists only commits that touch other files, at each of the four points.
