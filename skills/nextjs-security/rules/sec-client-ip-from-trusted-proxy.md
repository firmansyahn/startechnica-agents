---
title: The client IP comes from the trusted proxy only
impact: CRITICAL
tags: requests
check: scan, review
---

## The client IP comes from the trusted proxy only

**Impact: CRITICAL**

Read the address the trusted proxy appends (a configured hop count from the right of `X-Forwarded-For`, or its dedicated header). The left-most `X-Forwarded-For` value is whatever the client sent.

**How to check:** `scripts/scan.sh` flags the left-most `X-Forwarded-For` value: `.split(...)[0]`, `.split(...).shift()`, `.split(...).at(0)` on the header, and `const [ip] = ...x-forwarded-for...`. It misses the header read into a variable first and split elsewhere; review other reads of it, and `req.ip`, which `nextjs-upgrade`'s scan flags.
