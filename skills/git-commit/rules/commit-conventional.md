---
title: Write Conventional Commits with the component as scope
impact: LOW
tags: commit-message, conventional-commits
check: scan, review
---

## Write Conventional Commits with the component as scope

**Impact: LOW** (history can't be scanned by component or type; changelogs and release notes need hand work)

Every commit message is `<type>(<scope>): <description>` per Conventional Commits 1.0.0. The type is `feat`, `fix` or one of `build`, `chore`, `ci`, `docs`, `perf`, `refactor`, `revert`, `style`, `test`; the scope is the component touched (app, package, chart, module, top-level folder); a breaking change gets `!` or a `BREAKING CHANGE:` footer. Repos with an older style switch to this one.

**Incorrect:**

```
Updated files
[web] fix dark mode
WIP
```

**Correct:**

```
fix(web): lighten the dark-mode destructive red so error text is readable
feat(api)!: drop the v1 list endpoints

BREAKING CHANGE: clients must page with /v2/items.
```

**How to check:** `git log --format=%s <base>..HEAD | grep -vE '^(feat|fix|build|chore|ci|docs|perf|refactor|revert|style|test)(\([^)]+\))?!?: |^Merge '` prints nothing.
