---
title: Close every cursor and check its error
impact: HIGH
tags: mongodb, cursors, resources, errors
check: scan, review
---

## Close every cursor and check its error

**Impact: HIGH** (an open cursor keeps a server-side cursor alive until it times out after ten minutes, and an unchecked `cursor.Err()` returns a truncated list as if it were complete)

`Find`, `Aggregate` and `Watch` return a cursor or change stream that must be closed. Prefer `cursor.All(ctx, &out)`, which iterates, decodes and closes for you; when you iterate yourself (large results, streaming), `defer cur.Close(ctx)` right after the error check and check `cur.Err()` after the loop.

**Incorrect:**

```go
cur, err := s.orders().Find(ctx, bson.D{{Key: "customer_id", Value: id}})
if err != nil {
	return nil, err
}
var out []Order
for cur.Next(ctx) {
	var o Order
	_ = cur.Decode(&o)
	out = append(out, o)
}
return out, nil // cursor left open; a network error mid-iteration is silently a short list
```

**Correct:**

```go
cur, err := s.orders().Find(ctx, bson.D{{Key: "customer_id", Value: id}}, options.Find().SetLimit(limit))
if err != nil {
	return nil, fmt.Errorf("list orders: %w", err)
}
var out []Order
if err := cur.All(ctx, &out); err != nil { // iterates, decodes, closes
	return nil, fmt.Errorf("list orders: %w", err)
}
return out, nil
```

Iterating yourself: `defer cur.Close(ctx)`, check every `cur.Decode` error, then `if err := cur.Err(); err != nil { ... }` after the loop.

**How to check:** `scripts/scan.sh` flags `cur, err := ….Find(`/`Aggregate(`/`Watch(` with no `.Close(ctx)` or `.All(` before the end of the function. In review, also look for ignored `Decode` errors and a missing `Err()` check.
