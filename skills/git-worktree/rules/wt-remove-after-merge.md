---
title: Remove the worktree and its branch once the MR merged
impact: LOW
tags: worktree, cleanup, merge
check: scan, review
---

## Remove the worktree and its branch once the MR merged

**Impact: LOW** (stale worktrees and branches pile up, hold disk and locks, and get mistaken for live work)

When the MR merged and its commits are on its target branch, remove the worktree and delete the local branch straight away, without asking. GitLab deletes the remote source branch on merge; confirm it. Follow `wt-stop-processes-before-remove` and `wt-unlink-before-remove` on the way.

**Incorrect:**

```sh
glab mr merge 42 --yes --sha <sha>
# done; .worktrees/report and feat/report left behind
```

**Correct:**

```sh
git fetch origin && git branch -r --contains <merge commit>   # origin/<target>
git worktree remove .worktrees/report
git branch -D feat/report
git ls-remote --heads origin feat/report                       # prints nothing
```

**How to check:** `scripts/scan.sh` lists worktrees whose folder is gone, and worktrees and local branches whose upstream branch is gone from the remote (`[gone]` after `git fetch --prune`; GitLab deletes the source branch on merge). It misses a branch pushed without an upstream (`-u`), and a remote branch deleted without a merge is a false positive: confirm the MR merged. In review, `git worktree list` and `git branch --merged origin/<target>` show no finished branches.
