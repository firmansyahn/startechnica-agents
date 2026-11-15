---
title: The matcher matches the prefix list
impact: MEDIUM
tags: testing
check: scan, review
---

## The matcher matches the prefix list

**Impact: MEDIUM**

A test compares `config.matcher` in `proxy.ts` with the prefix lists the code uses, so adding a backend path in one place and forgetting the other fails.

**How to check:** `scripts/scan.sh` reports a `proxy.ts` or `middleware.ts` that exports `config` while no `*.test.ts(x)` reads `config.matcher` (or `config["matcher"]`). It shows the test exists, not that it compares the matcher with every prefix list the code uses; read it.
