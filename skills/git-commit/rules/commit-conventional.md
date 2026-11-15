---
title: Write Conventional Commits with the component as scope
impact: LOW
tags: commit-message, conventional-commits
check: scan, hook, review
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

**How to check:** `scripts/scan.sh` lists the subjects in `<base>..HEAD` that aren't `<type>(<scope>)!: <description>` (merges excepted), and the `assets/hooks/commit-msg` git hook refuses such a subject at commit time (it lets `fixup!`/`squash!`/`amend!` commits through, which an autosquash rebase folds away). Neither can tell whether the scope names the component touched, or whether the description says what changed: that stays review.
