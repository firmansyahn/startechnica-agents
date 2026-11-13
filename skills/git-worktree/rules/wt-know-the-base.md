---
title: Know the branch's base, and target the MR at it
impact: MEDIUM
tags: worktree, branches, base, merge-request
check: review
---

## Know the branch's base, and target the MR at it

**Impact: MEDIUM** (the MR targets a branch the work didn't start from, so it carries unrelated commits or misses the ones it builds on; or a worktree is reset away from the base the user chose)

A worktree's branch can start from any ref: `HEAD`, the integration branch, another MR's branch in a stack, a release branch. Use the base the user names, otherwise the harness's or upstream's default (`HEAD`), and never move a worktree onto a different base on your own. Note the base when you create it: the MR targets it, and it is the branch you merge from to stay current.

**Incorrect:**

```sh
git worktree add -b feat/report .worktrees/report feat/export   # stacked on feat/export
git reset --hard origin/develop                                 # "fixing" the base nobody asked to change
glab mr create --target-branch develop                          # MR now shows feat/export's commits too
```

**Correct:**

```sh
git worktree add -b feat/report .worktrees/report feat/export
glab mr create --target-branch feat/export                      # the base it was cut from
git merge origin/feat/export                                    # staying current: merge from the same base
```

When the base isn't known (a worktree someone else made), work it out before the MR: `git log --oneline --decorate -5`, the branch's upstream, the plan or the user. Ask if it's still unclear.

**How to check:** `git log --oneline origin/<target>..HEAD` lists only the branch's own commits.
