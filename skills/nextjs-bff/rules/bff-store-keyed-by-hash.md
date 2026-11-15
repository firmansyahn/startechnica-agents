---
title: The store is keyed by a hash of the cookie id
impact: CRITICAL
tags: session
check: test, scan (candidates), review
---

## The store is keyed by a hash of the cookie id

**Impact: CRITICAL**

The store key is `sha256(cookieId)`, never the id itself, so a dump of the store (or its logs) yields no working cookie.

**How to check:** a store test: after a session is created, no key in the in-memory store contains the cookie id, and one key is derived from `sha256(cookieId)` (hex, or the project's encoding). `scripts/scan.sh` flags a store client or `new Map(` under `src/api/` when nothing there mentions `sha256`; a hash under another name is a false hit.
