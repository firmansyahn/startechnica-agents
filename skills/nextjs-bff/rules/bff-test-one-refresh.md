---
title: Concurrent requests near expiry cause one refresh
impact: MEDIUM
tags: testing
check: review
---

## Concurrent requests near expiry cause one refresh

**Impact: MEDIUM**

Start two requests for a session whose token is about to expire; the token endpoint fake sees one refresh, both requests succeed with the new token, and the record's revision advanced once.
