---
title: Sync once per merge of the base, then stop and report
impact: MEDIUM
tags: worktree, merge, conflicts, parallel, integrator
check: review
---

## Sync once per merge of the base, then stop and report

**Impact: MEDIUM** (every merge makes the open branches stale, so agents merge the base, push and merge it again as each sibling lands: pipelines restart each time and nothing reaches green)

- **One sync per merge of the base.** Merge the base, resolve, run the checks, push. If the second sync in a row still conflicts in files the worktree doesn't own, stop and report the files and the sibling MR to the lead or the user instead of trying again.
- **Merge from the base only.** Never merge a sibling's branch into yours: its commits arrive when it merges into the base, and work that needs them is a stack (`gitlab-stacked-mrs`). Never rebase and force-push a pushed branch: it replays conflicts you already resolved.
- **One MR merges at a time**, by one integrator (the lead agent or the user), in dependency order, each on its own green pipeline (`mr-merge-after-green-pipeline`). After each merge only the worktrees that share files with it need to sync (`wt-disjoint-files` names them).
- **Don't require an up-to-date branch.** Plain merge commits (`gitlab-mr` section 4) keep an open MR mergeable without a rebase. A project merge method that does require it (fast-forward, semi-linear) puts every other MR back in line after each merge, which is the loop.

**Incorrect:**

```sh
# worktree B, again after each of A, C and D merged
git rebase origin/develop && git push --force-with-lease
```

**Correct:**

```sh
git fetch origin && git merge origin/develop    # once per merge of the base
# the second sync still conflicts in files B doesn't own: stop and report
# "blocked: <files> are also changed by MR !<iid>"
```

**How to check:** in review, the branch has one merge of the base per merge on the base, and no force-push. The project's merge method is "Merge commit".
