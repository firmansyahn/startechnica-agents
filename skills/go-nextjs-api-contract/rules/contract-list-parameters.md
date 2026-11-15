---
title: Lists take offset, limit, sort, q and named filters, and answer total
impact: MEDIUM
tags: lists, pagination, query-params
check: test, review
---

## Lists take offset, limit, sort, q and named filters, and answer total

**Impact: MEDIUM** (every list inventing its own parameters means every table needs its own client code)

**Incorrect:**

```
GET /items/search?page=2&pageSize=50&orderBy=name&orderDir=desc&filter={"status":"active"}
→ { "items": [...], "count": 132 }
```

**Correct:**

```
GET /items?offset=50&limit=50&sort=-name&status=active
→ { "status": "success", "data": [...], "total": 132 }
```

**How to check:** `assets/openapi_rules_test.go` checks every GET whose 200 reply has a `data` array: no `page`, `pageSize`, `per_page`, `orderBy`, `orderDir`, `filter`, `search` or `count` parameter; `offset`, `limit` and `sort` present; a required integer `total` in the reply (a cursor list with `after` takes `limit` and no `offset` or `total`). In review: whether the other parameters are filters named like their fields.
