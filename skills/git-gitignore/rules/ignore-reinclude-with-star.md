---
title: Ignore a folder's contents, not the folder, to keep a file in it
impact: MEDIUM
tags: negation, patterns
check: scan, review
---

## Ignore a folder's contents, not the folder, to keep a file in it

**Impact: MEDIUM** (the negation silently does nothing, so a file meant to be committed (a tool release, a shared setting) is ignored)

git doesn't look inside an excluded folder, so a negation for a path in it never applies: after `.yarn/`, `!.yarn/releases` is dead. Exclude the folder's contents with `dir/*` (or `dir/**` for deeper levels) and then negate what to keep.

**Incorrect:**

```gitignore
.yarn/
!.yarn/releases
```

**Correct:**

```gitignore
.yarn/*
!.yarn/releases
```

**How to check:** the skill's `scripts/scan.sh` flags a negation whose parent folder is excluded by an earlier `<folder>/` line in the same file; `git check-ignore -v <kept file>` confirms.
