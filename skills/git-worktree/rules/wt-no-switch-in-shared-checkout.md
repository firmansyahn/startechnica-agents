---
title: Don't switch branches in a checkout someone else is using
impact: HIGH
tags: worktree, branches, parallel-sessions
check: review
---

## Don't switch branches in a checkout someone else is using

**Impact: HIGH** (another session's edits and next commit land on your branch, or its WIP is carried to the wrong one)

Several people or agent sessions may work in one checkout. Switching its branch moves `HEAD` under them. Before any `git switch`/`checkout`, look at `git status` and `git reflog -3`: if the tree has changes you didn't make or the branch isn't yours, make a worktree instead.

**Incorrect:**

```sh
git switch -c chore/fix-typo     # in the main checkout, with another session's uncommitted files
```

**Correct:**

```sh
git status --short; git reflog -3
git worktree add -b chore/fix-typo .worktrees/fix-typo <base-ref>
```

**How to check:** `git reflog` of the shared checkout shows no branch changes you made while it had others' work in it.
