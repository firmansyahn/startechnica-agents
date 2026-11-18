# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Worktrees | `wt-` | HIGH | When to make one, where it starts, its dependencies, removing it safely |
| 2 | Parallel work | `wt-` | MEDIUM | Splitting files between worktrees, hot files, syncing with the base, merge order |

Impact is the default severity of a finding; raise it by one level when another session is known to be working in the checkout involved.
