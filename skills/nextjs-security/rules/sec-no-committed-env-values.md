---
title: .env files with real values are never committed
impact: HIGH
tags: data
check: review
---

## .env files with real values are never committed

**Impact: HIGH**

`.env*` is gitignored except `.env.example`, which lists names with dummy values. Real values come from the secret store at deploy time. A secret that was committed is rotated, not just deleted.
