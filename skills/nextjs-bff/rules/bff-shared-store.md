---
title: The store is shared by every replica
impact: CRITICAL
tags: session
check: review
---

## The store is shared by every replica

**Impact: CRITICAL**

Redis or Valkey when the app runs more than one instance; an in-memory store only in development and tests. A per-process store signs users out whenever the load balancer picks another pod.
