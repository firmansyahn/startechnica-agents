---
title: Declare the index every query needs, in code or a migration
impact: HIGH
tags: mongodb, indexes, performance, schema
check: test, review
---

## Declare the index every query needs, in code or a migration

**Impact: HIGH** (a query with no supporting index scans the whole collection: fine on a test database, minutes and a saturated primary in production; a uniqueness rule checked with find-then-insert lets two concurrent requests both insert)

Every filter and sort the service runs has an index that supports it, declared next to the queries (an `EnsureIndexes` in the store, run at startup or as a migration step) with an explicit name, so it is reviewed with the code and reproduced in every environment and test. Compound indexes follow the equality, sort, range order. Uniqueness is a unique index, not a check before the insert. Indexes are never created by hand in one environment or by an agent through an MCP server.

**Incorrect:**

```go
// no index on (tenant_id, email): COLLSCAN on every sign-in
n, err := s.customers().CountDocuments(ctx, bson.D{{Key: "tenant_id", Value: t}, {Key: "email", Value: email}})
if n == 0 {
	_, err = s.customers().InsertOne(ctx, c) // two requests both see 0 and both insert
}
```

**Correct:**

```go
func (s *Store) EnsureIndexes(ctx context.Context) error {
	_, err := s.customers().Indexes().CreateMany(ctx, []mongo.IndexModel{{
		Keys:    bson.D{{Key: "tenant_id", Value: 1}, {Key: "email", Value: 1}},
		Options: options.Index().SetName("customers_tenant_email_unique").SetUnique(true),
	}})
	if err != nil {
		return fmt.Errorf("create customer indexes: %w", err)
	}
	return nil
}

_, err = s.customers().InsertOne(ctx, c)
if mongo.IsDuplicateKeyError(err) {
	return customer.ErrEmailTaken
}
```

Creating an index that already exists with the same keys and options is a no-op; changing an existing index's options needs a new name or a drop first, done as a reviewed migration. On a large production collection, build new indexes as a planned rollout step, not on every pod's start.

**How to check:** a store test runs `EnsureIndexes` against a real MongoDB and runs the main queries with `explain` (or `SetHint` on the declared index name) to assert an `IXSCAN`, not a `COLLSCAN`. In review, match each new filter and sort to a declared index.
