---
title: One refresh at a time per session, across replicas
impact: CRITICAL
tags: session
check: review
---

## One refresh at a time per session, across replicas

**Impact: CRITICAL**

Take a store lock (`SET key NX PX`), refresh, write the record back only if its revision is unchanged (compare-and-set), release. Other requests wait briefly and re-read the record. Refresh tokens rotate: two parallel refreshes reuse the old token, the server's reuse detection revokes the family, and the user is signed out.
