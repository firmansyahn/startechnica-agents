---
title: Translate ErrNoDocuments and duplicate keys into domain errors in the store
impact: MEDIUM
tags: mongodb, errors
check: scan (candidates), review
---

## Translate ErrNoDocuments and duplicate keys into domain errors in the store

**Impact: MEDIUM** (a missing customer answers 500 instead of 404, a unique-index violation answers 500 instead of 409, and handlers end up importing the driver to tell them apart)

The package that talks to MongoDB turns `mongo.ErrNoDocuments` into the domain's not-found error with `errors.Is`, and a duplicate-key write (`mongo.IsDuplicateKeyError`, which also sees through bulk-write errors) into the domain's conflict error. An update or delete that must hit one document checks `MatchedCount`/`DeletedCount`, since a filter that matches nothing is not an error. Never compare `err ==` or match on `E11000` in the message.

**Incorrect:**

```go
err := s.customers().FindOne(ctx, filter).Decode(&c)
if err == mongo.ErrNoDocuments { // breaks once the error is wrapped
	return Customer{}, err      // the driver error leaks to the handler
}

_, err = s.customers().InsertOne(ctx, c)
if err != nil && strings.Contains(err.Error(), "E11000") {
	return ErrConflict
}
```

**Correct:**

```go
err := s.customers().FindOne(ctx, filter).Decode(&c)
if errors.Is(err, mongo.ErrNoDocuments) {
	return Customer{}, customer.ErrNotFound
}
if err != nil {
	return Customer{}, fmt.Errorf("get customer %s: %w", id.Hex(), err)
}

_, err = s.customers().InsertOne(ctx, c)
if mongo.IsDuplicateKeyError(err) {
	return customer.ErrEmailTaken
}

res, err := s.customers().UpdateOne(ctx, filter, update)
if err != nil {
	return fmt.Errorf("rename customer: %w", err)
}
if res.MatchedCount == 0 {
	return customer.ErrNotFound
}
```

**How to check:** `scripts/scan.sh` flags `== mongo.ErrNoDocuments`, `!= mongo.ErrNoDocuments` and `E11000` in Go code. In review, look for `UpdateOne`/`DeleteOne` results that are discarded where "nothing matched" should be reported.
