---
title: Don't switch branches in a checkout someone else is using
impact: HIGH
tags: worktree, branches, parallel-sessions
check: hook, review
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

**How to check:** the `guard-shared-checkout.mjs` hook (`assets/hooks/`) refuses `git switch`, `git checkout <branch>`, `git checkout -b`, `glab mr checkout` and `gh pr checkout` in the main checkout while `git status --porcelain` lists anything; restoring files (`git checkout -- <path>`) and linked worktrees pass, and `SWITCH_SHARED=1` in front lets a deliberate switch through. It refuses on your own changes too (it can't tell whose they are), and it doesn't see a switch made in a terminal outside the agent or a shared linked worktree. In review, `git reflog` of the shared checkout shows no branch changes you made while it had others' work in it.
