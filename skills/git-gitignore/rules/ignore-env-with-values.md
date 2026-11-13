---
title: Ignore env files with values; commit the example
impact: HIGH
tags: secrets, env
check: scan, review
---

## Ignore env files with values; commit the example

**Impact: HIGH** (credentials and local settings get committed, and stay in history after they are removed)

Every `.env` variant that holds values (`.env`, `.env.local`, `.env.production`, an app folder's own) is ignored. The file that documents the variables, `.env.example` with placeholder values, is committed so a new clone knows what to set. Ignoring only `.env` leaves `.env.local` and its siblings one `git add .` away from history.

**Incorrect:**

```gitignore
.env
```

**Correct:**

```gitignore
.env
.env.*
!.env.example
```

**How to check:** the skill's `scripts/scan.sh` lists tracked env files other than examples and an env file in the tree that no rule ignores; in review, a new env file name gets a pattern in the same change.
