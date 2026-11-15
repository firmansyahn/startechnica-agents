---
title: The server caps limit and whitelists sort fields
impact: HIGH
tags: lists, sql, security
check: test, lint (gosec G201, G202), review
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

**How to check:** `assets/openapi_rules_test.go` fails when a `limit` parameter has no `maximum` or a `sort` parameter no `enum` in the document. `assets/openapi_lists_test.go` calls every documented list through the real handler: a limit far above the maximum must answer 200 with at most the maximum rows, and an unknown sort field 400 or 422, never a 5xx; the clamp itself is proved only when the seed data has more rows than the maximum. golangci-lint `gosec` (G201, G202) and `go-security`'s scan (`sec-sql-parameterized`) flag a value formatted into SQL. In review: the `id` tiebreaker, and lists the document doesn't declare.
