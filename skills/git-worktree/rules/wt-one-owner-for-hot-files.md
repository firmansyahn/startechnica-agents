---
title: Let one worktree own each hot shared file
impact: MEDIUM
tags: worktree, parallel, conflicts, generated-files, versions
check: review
---

## Let one worktree own each hot shared file

**Impact: MEDIUM** (every parallel change edits the same line, so every merge after the first conflicts, however small the changes are)

Some files are edited by almost every change: a version field, an inventory table or index, a changelog, a route or registry list, a lockfile, a generated file. Parallel worktrees collide there every time. List them in the project's `AGENTS.md`. Then either one worktree (or the last MR of the batch) edits each of them, or the project changes its shape so the file stops being hot: one file per item instead of a shared list, an index generated instead of typed. Lockfiles and generated files are regenerated after the merge (section 4 of this skill), never merged by hand. A formatting sweep or line-ending renormalisation is its own MR, merged before the parallel work starts or after it all landed.

**Incorrect (three worktrees):**

```text
each bumps the same `version:` line and adds its own row to the same table
```

**Correct:**

```text
each adds its own file; the last MR of the batch bumps the version once and adds the three rows
```

**How to check:** the project's `AGENTS.md` names its hot files and who edits them. A file that `scan.sh` reports under `wt-disjoint-files` in several worktrees, and that isn't in the list, belongs in it.
