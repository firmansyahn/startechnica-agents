---
title: Land the version upgrade before any stack change
impact: MEDIUM
tags: migrate, upgrade, scope
check: review
---

## Land the version upgrade before any stack change

**Impact: MEDIUM** (mixing the version jump with library swaps makes every regression ambiguous and the merge request unreviewable)

Migrate mode starts with Yarn (phase 1), then the upgrade (phase 2), each merged on its own. Only then do the stack phases begin. A stack change that the target forces (a library with no supporting release) is still made in the upgrade, as a forced change, not as a team-stack move.

**Incorrect:**

```text
MR !1  build(web): upgrade next to 16, move to app router, tanstack query and tailwind 4
```

**Correct:**

```text
MR !1  build(web): switch to yarn
MR !2  build(web): upgrade next to 16
MR !3  refactor(web): move customers routes to the app router
```

**How to check:** the first merge requests of a migration touch only the package manager, then only versions; review the merge request list against the phase order in [references/migrate-mode.md](../references/migrate-mode.md).
