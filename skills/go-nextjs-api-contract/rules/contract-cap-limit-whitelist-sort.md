---
title: The server caps limit and whitelists sort fields
impact: HIGH
tags: lists, sql, security
check: review
---

## The server caps limit and whitelists sort fields

**Impact: HIGH** (an unchecked sort field is SQL injection, and an unbounded limit is a cheap denial of service)

`limit` above the maximum is clamped; `sort` accepts only the fields the operation lists (an `enum` in the document) and the server appends `id` as a tiebreaker so pages don't overlap. A sort field passed into SQL unchecked is an injection.

**Incorrect:**

```go
q := fmt.Sprintf("SELECT ... ORDER BY %s LIMIT %s", r.URL.Query().Get("sort"), r.URL.Query().Get("limit"))
```

**Correct:**

```go
order, ok := itemSorts[sortKey]          // map of allowed keys → fixed SQL fragments
limit := min(max(limitParam, 1), 200)
```

**How to check:** in review, `sort`/`limit` values reaching SQL without a lookup and a clamp; the document's `sort` parameter has an `enum`.
