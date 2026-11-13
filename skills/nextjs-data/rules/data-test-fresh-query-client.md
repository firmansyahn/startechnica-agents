---
title: A fresh QueryClient per test, with retry off
impact: MEDIUM
tags: testing
check: review
---

## A fresh QueryClient per test, with retry off

**Impact: MEDIUM**

Render through a helper (`renderWithQuery`) that builds a new client with `retry: false` and `gcTime: Infinity`. A shared client leaks cached data between tests; retries make error tests wait.
