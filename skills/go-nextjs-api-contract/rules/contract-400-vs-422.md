---
title: 400 for unreadable requests, 422 for invalid values
impact: MEDIUM
tags: errors, status-codes
check: test
---

## 400 for unreadable requests, 422 for invalid values

**Impact: MEDIUM** (a 400 for a rule violation carries no field errors, and a 422 for garbage invites a form to show it)

Unparseable JSON, a string where a number is documented, an unknown query parameter or a bad path segment is a 400. A readable body whose values break a rule (required, range, unique, cross-field) is a 422 with `errors`.

**How to check:** handler tests send malformed JSON (expect 400) and a readable body breaking a rule (expect 422 with `errors`).
