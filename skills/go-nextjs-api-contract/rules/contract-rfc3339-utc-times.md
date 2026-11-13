---
title: Times are RFC 3339 in UTC
impact: MEDIUM
tags: dates, json
check: review
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

**How to check:** the document declares every time field `format: date-time`; in review, times sent without an offset.
