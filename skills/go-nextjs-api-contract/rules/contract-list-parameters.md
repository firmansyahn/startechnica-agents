---
title: Lists take offset, limit, sort, q and named filters, and answer total
impact: MEDIUM
tags: lists, pagination, query-params
check: review
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

**How to check:** in review, list operations in the document using other parameter names or replying without `total`.
