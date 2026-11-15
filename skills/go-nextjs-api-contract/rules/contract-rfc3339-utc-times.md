---
title: Times are RFC 3339 in UTC
impact: MEDIUM
tags: dates, json
check: test, review
---

## Times are RFC 3339 in UTC

**Impact: MEDIUM** (local formats and epoch numbers are misread across time zones and locales)

**Incorrect:**

```json
{ "created_at": "13/11/2026 14:15", "expires": 1794632105 }
```

**Correct:**

```json
{ "created_at": "2026-11-13T07:15:05Z", "expires_at": "2026-11-20T07:15:05Z" }
```

The frontend formats them for display with the user's locale and time zone; it never sends a local time without an offset.

**How to check:** `assets/openapi_rules_test.go` fails on a property or query parameter named `*_at`, `*_date`, `*_time`, `expires`, `timestamp`, `date` or `time` that isn't a string with `format: date-time` (or `date`). It misses time fields named outside that convention. In review: times sent without an offset, or a `time.Time` not converted to UTC before it is marshalled.
