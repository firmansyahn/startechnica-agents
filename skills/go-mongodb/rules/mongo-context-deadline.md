---
title: Run every operation with the request's context and a client-wide timeout
impact: HIGH
tags: mongodb, context, timeouts
check: scan, review
---

## Run every operation with the request's context and a client-wide timeout

**Impact: HIGH** (with `context.Background()` an operation keeps a pooled connection after the client has gone; with no timeout at all a slow primary election or an unindexed query holds every connection until the pool is exhausted)

Every driver call takes the caller's `ctx`, so cancellation and the request deadline reach the server. The Client also sets `SetTimeout` (the `timeoutMS` client-side operation timeout, CSOT), which bounds server selection, connection checkout, execution and retries for any call whose context has no deadline; a context deadline overrides it. v2 removed `SetSocketTimeout` and the per-operation `SetMaxTime`: don't look for them.

**Incorrect:**

```go
func (s *Store) GetCustomer(ctx context.Context, id bson.ObjectID) (Customer, error) {
	var c Customer
	err := s.customers().FindOne(context.Background(), bson.D{{Key: "_id", Value: id}}).Decode(&c)
	return c, err
}

client, err := mongo.Connect(options.Client().ApplyURI(cfg.URI)) // no timeout: calls can wait forever
```

**Correct:**

```go
func (s *Store) GetCustomer(ctx context.Context, id bson.ObjectID) (Customer, error) {
	var c Customer
	err := s.customers().FindOne(ctx, bson.D{{Key: "_id", Value: id}}).Decode(&c)
	...
}

client, err := mongo.Connect(options.Client().
	ApplyURI(cfg.URI).
	SetTimeout(cfg.Timeout). // e.g. 5s; a deadline on ctx wins
	SetServerSelectionTimeout(cfg.ServerSelectionTimeout))
```

Background work (a worker, a migration, a change stream) derives its context from the process's shutdown context, with its own `context.WithTimeout` per unit of work.

**How to check:** `scripts/scan.sh` flags driver calls whose first argument is `context.Background()` or `context.TODO()`, and a module that calls `mongo.Connect` with no `SetTimeout` or `timeoutMS` anywhere. In review, follow `ctx` from the handler to the call.
