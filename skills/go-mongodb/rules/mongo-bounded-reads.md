---
title: Bound every list read with a limit, a projection and keyset pagination
impact: MEDIUM
tags: mongodb, pagination, performance
check: scan (candidates), review
---

## Bound every list read with a limit, a projection and keyset pagination

**Impact: MEDIUM** (an unbounded `Find` decodes a whole collection into memory; `skip(n)` still walks and discards `n` index entries, so deep pages get slower page by page and shift when documents are inserted)

A list endpoint sets `SetLimit` from a capped page size, a `SetProjection` with only the fields it returns, and a deterministic `SetSort` that ends in a unique field (`_id`). The next page continues after the last key returned (`_id > last`, or `(created_at, _id)` past the last pair), with an index on the filter fields plus the sort keys. `SetSkip` is for small, bounded offsets only.

**Incorrect:**

```go
opts := options.Find().SetSkip(int64(page * size)).SetLimit(int64(size)) // page 10 000 walks 10 000 × size entries
cur, err := s.orders().Find(ctx, bson.D{{Key: "customer_id", Value: id}}, opts)
```

**Correct:**

```go
filter := bson.D{{Key: "customer_id", Value: id}}
if !after.IsZero() {
	filter = append(filter, bson.E{Key: "_id", Value: bson.D{{Key: "$gt", Value: after}}})
}
opts := options.Find().
	SetSort(bson.D{{Key: "_id", Value: 1}}).
	SetLimit(min(size, maxPageSize)).
	SetProjection(bson.D{{Key: "total_cents", Value: 1}, {Key: "status", Value: 1}, {Key: "created_at", Value: 1}})
cur, err := s.orders().Find(ctx, filter, opts) // index: {customer_id: 1, _id: 1}
```

**How to check:** `scripts/scan.sh` flags `SetSkip(`. In review, every `Find` and `Aggregate` that returns a list has a limit (or a `$limit` stage) and a projection, and its sort ends in a unique field.
