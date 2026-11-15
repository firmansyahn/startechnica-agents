---
title: A fresh QueryClient per test, with retry off
impact: MEDIUM
tags: testing
check: scan, review (the helper's options)
---

## A fresh QueryClient per test, with retry off

**Impact: MEDIUM**

Render through a helper (`renderWithQuery`) that builds a new client with `retry: false` and `gcTime: Infinity`. A shared client leaks cached data between tests; retries make error tests wait.

**How to check:** `scripts/scan.sh` lists `new QueryClient(` in test files (`*.test.ts[x]`): a test renders through the helper instead of building or sharing its own client. Review the helper itself: `retry: false` and `gcTime: Infinity`.
