---
title: The store is keyed by a hash of the cookie id
impact: CRITICAL
tags: session
check: review
---

## The store is keyed by a hash of the cookie id

**Impact: CRITICAL**

The store key is `sha256(cookieId)`, never the id itself, so a dump of the store (or its logs) yields no working cookie.
