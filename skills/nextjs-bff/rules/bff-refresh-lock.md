---
title: One refresh at a time per session, across replicas
impact: CRITICAL
tags: session
check: test, scan (candidates), review
---

## One refresh at a time per session, across replicas

**Impact: CRITICAL**

Take a store lock (`SET key NX PX`), refresh, write the record back only if its revision is unchanged (compare-and-set), release. Other requests wait briefly and re-read the record. Refresh tokens rotate: two parallel refreshes reuse the old token, the server's reuse detection revokes the family, and the user is signed out.

**How to check:** the concurrency test `bff-test-one-refresh` asks for, run with two store clients on one store (a Redis or Valkey service in CI, or two in-memory store instances over one backing map that honours `NX` and the compare-and-set), so the lock holds across replicas. `scripts/scan.sh` flags a refresh (`refresh_token`) under `src/api/` when nothing there takes a lock (`"NX"`, `NX: true`, Redlock); whether the write-back is a compare-and-set stays review.
