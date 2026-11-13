---
title: Add size and secret patterns to .dockerignore too
impact: MEDIUM
tags: docker, secrets, build-context
check: review
---

## Add size and secret patterns to .dockerignore too

**Impact: MEDIUM** (dependencies, worktrees and env files go into the image build context: slow builds, and secrets in an image layer)

`.gitignore` doesn't affect Docker. When a pattern is about size or secrets (dependency folders, env files, captures, build output, worktree folders), add it to `.dockerignore` as well, and to other tools' ignore files the repo has (code indexers, linters). `.dockerignore` matches relative to the build context and a bare name only at its root, so a pattern that should match at any depth needs `**/`.

**Incorrect:**

```gitignore
# .dockerignore
node_modules
.env
```

**Correct:**

```gitignore
# .dockerignore
**/node_modules
**/.env
**/.env.*
!**/.env.example
.worktrees
```

**How to check:** In review, every size or secret pattern added to `.gitignore` has its `.dockerignore` counterpart; `docker build` with `--progress=plain` shows the context size.
