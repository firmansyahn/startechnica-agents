---
title: Every route is documented and every operation routed
impact: MEDIUM
tags: tests, routes, openapi
check: test
---

## Every route is documented and every operation routed

**Impact: MEDIUM** (a hand-mounted handler or a stale documented path goes unnoticed)

A test walks the route table against the document's operations in both directions, so a hand-mounted handler or a stale documented path fails the build.

**How to check:** a test walks the route table against the document's operations in both directions.
