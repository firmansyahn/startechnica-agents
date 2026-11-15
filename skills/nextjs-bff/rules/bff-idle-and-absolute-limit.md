---
title: The session has an idle and an absolute limit
impact: CRITICAL
tags: session
check: test, review
---

## The session has an idle and an absolute limit

**Impact: CRITICAL**

The record's TTL is the idle limit, renewed on use but never past the absolute limit from sign-in (for example 30 minutes idle, 12 hours absolute), matching the authorization server's refresh-token lifetimes for this client.

**How to check:** a session-store test with a fake clock (`vi.useFakeTimers()`, the in-memory store): each use moves the record's TTL to the idle limit; a record used every few minutes still expires at sign-in plus the absolute limit; an unused one expires at the idle limit. Whether the limits match the authorization server's refresh-token lifetimes for this client stays review.
