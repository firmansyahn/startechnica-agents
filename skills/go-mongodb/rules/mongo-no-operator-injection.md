---
title: Build filters and updates from typed values, never from request documents
impact: CRITICAL
tags: mongodb, security, injection
check: scan (candidates), review
---

## Build filters and updates from typed values, never from request documents

**Impact: CRITICAL** (a request body decoded into `bson.M` and used as a filter lets the caller send `{"password": {"$ne": ""}}` or `{"$where": ...}`, matching every document or running JavaScript on the server; used as an update, it lets them `$set` any field, including roles and the tenant)

NoSQL injection in MongoDB is operator injection: the danger is a `$`-key the caller chose, not a quote. Decode requests into typed structs, then build `bson.D` filters and updates field by field from those values, each under a key the code names. Sort and projection fields from the query string go through an allow-list. Never use `$where`, `$function` or `$accumulator`: they run JavaScript server-side and can't use indexes.

**Incorrect:**

```go
var filter bson.M
if err := json.NewDecoder(r.Body).Decode(&filter); err != nil { // {"email": {"$ne": null}} matches everyone
	return err
}
cur, err := s.customers().Find(ctx, filter)

update := bson.M{"$set": req.Fields} // req.Fields is map[string]any from JSON: any field can be set
```

**Correct:**

```go
type searchRequest struct {
	Email  string `json:"email"`
	Status string `json:"status"`
}

filter := bson.D{
	{Key: "tenant_id", Value: tenantID},           // scope from the session, never the body
	{Key: "email", Value: req.Email},              // a Go string is matched literally, never read as an operator
}
if req.Status != "" {
	filter = append(filter, bson.E{Key: "status", Value: req.Status})
}

update := bson.D{{Key: "$set", Value: bson.D{
	{Key: "name", Value: req.Name},
	{Key: "phone", Value: req.Phone},
}}}
```

A user-supplied string used inside `$regex` is escaped with `regexp.QuoteMeta` and anchored (`^`), or the search moves to a text or Atlas Search index.

**How to check:** `scripts/scan.sh` flags `$where`, `$function` and `$accumulator`, `bson.M(`/`bson.D(` conversions and `json` decoding into `bson.M`/`bson.D`/`map[string]any` in the same file as a driver call. In review, trace every filter, update, sort and projection to its source: each key comes from the code, each value from a typed field.
