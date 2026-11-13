---
title: Stage files by name; never commit ignored or secret files
impact: HIGH
tags: staging, secrets, shared-checkout
check: review
---

## Stage files by name; never commit ignored or secret files

**Impact: HIGH** (credentials, local settings, notes or another session's half-done files end up in history)

A working tree often holds more than your change: other sessions' edits, captures, notes, local config. `git add -A` takes all of it. Stage your files by name, read the staged diff, and never force-add an ignored file.

**Incorrect:**

```sh
git add -A && git commit -m "feat(customers): add the customer list"
git add -f .env
```

**Correct:**

```sh
git status --short
git add src/customers/list.tsx src/customers/list.test.tsx messages/en.json
git diff --cached
git commit -m "feat(customers): add the customer list"
```

**How to check:** `git diff --cached --name-only` lists only the change's files; nothing matching `.env*`, `*.local.json`, `*.pem`, `*.key` or notes folders.
