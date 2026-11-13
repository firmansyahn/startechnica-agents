---
title: Every route is in the document, with its reply types
impact: HIGH
tags: openapi, routes, document
check: test
---

## Every route is in the document, with its reply types

**Impact: HIGH** (an undocumented route has no checked contract, so clients and reply validation miss it)

A route added to the route table without request and reply types fails the document test; a route served outside the table (a handler mounted by hand) is invisible to the contract.

**Incorrect:**

```go
mux.HandleFunc("GET /api/v1/console/items/{id}/history", history)   // mounted by hand, undocumented
```

**Correct:**

```go
{Method: "GET", Path: "/items/{id}/history", Handler: history, Permission: "items.read",
	Summary: "An item's change history", Reply: httpx.Page[HistoryEntry]{}, Errors: []int{404}},
```

**How to check:** the document test fails for a route without request and reply types; review any handler mounted outside the route table.
