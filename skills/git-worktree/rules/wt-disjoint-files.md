---
title: Give parallel worktrees files nobody else touches
impact: MEDIUM
tags: worktree, parallel, conflicts, planning
check: scan, review
---

## Give parallel worktrees files nobody else touches

**Impact: MEDIUM** (two worktrees edit the same file, so whichever MR merges second conflicts, and its agent has to merge the base again)

Most conflicts are decided before the first edit. When more than one agent works in a repo, split the work so each worktree changes files the others don't, and name those files before anyone starts. Work that must touch the same files goes one after the other, as a stack (`gitlab-stacked-mrs`), not in parallel. An overlap found later is a reason to re-plan: move the edit to one worktree, or hold one back until the other has merged.

**Incorrect (two worktrees, both told "add your item and update the index"):**

```sh
git -C .worktrees/export diff --name-only origin/main...    # docs/index.md, src/export.ts
git -C .worktrees/report diff --name-only origin/main...    # docs/index.md, src/report.ts
```

**Correct (the shared file has one owner):**

```sh
# export owns docs/index.md and adds both entries; report leaves it alone
git -C .worktrees/report diff --name-only origin/main...    # src/report.ts
```

**How to check:** `bash <this skill>/scripts/scan.sh` lists every file changed in two worktrees since they last shared a commit, uncommitted changes included. A shared file may be deliberate (a stack builds on its parent), so confirm each. In review, each task in the plan names its files.
