---
title: The session has an idle and an absolute limit
impact: CRITICAL
tags: session
check: review
---

## The session has an idle and an absolute limit

**Impact: CRITICAL**

The record's TTL is the idle limit, renewed on use but never past the absolute limit from sign-in (for example 30 minutes idle, 12 hours absolute), matching the authorization server's refresh-token lifetimes for this client.
