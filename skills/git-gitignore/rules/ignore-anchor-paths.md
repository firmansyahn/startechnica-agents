---
title: Anchor paths that live in one place; slash-terminate folders
impact: LOW
tags: patterns
check: review
---

## Anchor paths that live in one place; slash-terminate folders

**Impact: LOW** (a bare name matches at every depth and catches source files or folders that share it)

A pattern without a slash matches at any level, files and folders alike: `build` ignores `src/build/` too. A path that exists in one place gets a leading `/` (relative to the `.gitignore` it is in); a folder gets a trailing `/`. Use a bare name only when matching at any depth is the point (`node_modules/`, `*.log`).

**Incorrect:**

```gitignore
build
coverage
test-results
```

**Correct:**

```gitignore
/build/
/coverage/
/test-results/
```

**How to check:** In review, each unanchored pattern is one that should match at any depth; `git check-ignore -v` on a source path with the same name shows a pattern that matches too much.
