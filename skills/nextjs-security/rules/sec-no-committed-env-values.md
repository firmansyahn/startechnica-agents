---
title: .env files with real values are never committed
impact: HIGH
tags: data
check: scan, review
---

## .env files with real values are never committed

**Impact: HIGH**

`.env*` is gitignored except `.env.example`, which lists names with dummy values. Real values come from the secret store at deploy time. A secret that was committed is rotated, not just deleted.

**How to check:** `scripts/scan.sh` flags every `.env*` file git tracks except `.env.example`, and a `.gitignore` that doesn't ignore `.env.local`. Review that `.env.example` holds dummy values, and rotate any secret that was ever committed (deleting the file doesn't remove it from history).
