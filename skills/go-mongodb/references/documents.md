# Documents, BSON mapping and queries

Read with [SKILL.md](../SKILL.md) when writing a document struct, a filter, an update, a list query, a bulk write or an aggregation. Schema shape (embed or reference, bucket, outlier, versioning) is `mongodb-schema-design`; index choice for a slow query is `mongodb-query-optimizer`.

## Document structs

```go
type Customer struct {
	ID        bson.ObjectID   `bson:"_id,omitempty"`
	TenantID  string          `bson:"tenant_id"`
	Email     string          `bson:"email"`
	Name      string          `bson:"name"`
	Balance   bson.Decimal128 `bson:"balance"`
	Tags      []string        `bson:"tags,omitempty"`
	Address   *Address        `bson:"address,omitempty"`
	Version   int64           `bson:"version"`
	CreatedAt time.Time       `bson:"created_at"`
	UpdatedAt time.Time       `bson:"updated_at"`
	DeletedAt *time.Time      `bson:"deleted_at,omitempty"`
}
```

- **Every field has a `bson` tag**, snake_case like the JSON and SQL columns. Without a tag the driver lower-cases the Go name (`TenantID` → `tenantid`), and a later rename of the Go field silently changes the stored key.
- **Document structs stay in the store package.** The Domain type is converted at the boundary; a `bson` tag never appears on an API type, and an API struct is never inserted as is.
- **v2 import paths:** `bson.ObjectID`, `bson.Decimal128`, `bson.D`, `bson.E`, `bson.M`, `bson.A`, `bson.Raw` are all in `go.mongodb.org/mongo-driver/v2/bson` (v1's `bson/primitive` is gone).
- **`_id`:** `bson.ObjectID` (`bson.NewObjectID()`, time-ordered, generated client-side) unless the project already uses UUIDv7 IDs across its stores; then keep that, stored the same way everywhere. Parse IDs from requests with `bson.ObjectIDFromHex` and answer 400/404 on an error, never 500.
- **`omitempty` traps:** a zero number, `false` or `""` is dropped on write, so "set to 0" and "not set" look the same, and a `$set` from a struct with `omitempty` fields can't clear a value. Use `omitempty` for `_id` (so the server or the code assigns it), optional pointers and slices; not for counters, flags or amounts. A struct field is only "empty" if its type has `IsZero() bool` (`time.Time` does); otherwise it is always written.
- **Time:** BSON dates are UTC milliseconds. Store `time.Time` in UTC, and expect a round trip to drop sub-millisecond precision: compare with `Truncate(time.Millisecond)` in tests.
- **Money:** integer minor units (`int64` cents) or `bson.Decimal128` (`bson.ParseDecimal128`); never `float64`.
- **Integers:** Go `int` is stored as int32 or int64 depending on the value; use `int64` (or `int32`) explicitly so the stored type doesn't change with the value.
- **Order matters in commands:** `bson.D` keeps order; `bson.M` doesn't. Use `bson.D` for sort, index keys, projections and pipeline stages; `bson.M` is acceptable only for a one-key filter in a test.
- **Unknown fields:** decoding ignores fields the struct doesn't have. A document read and written back whole with `ReplaceOne` loses them: prefer `$set` of the fields the code owns.
- **Schema validation:** a `$jsonSchema` validator on the collection, created in the same migration step as its indexes, catches writes from other tools (`mongodb-schema-design` references/fundamental-schema-validation.md).

## Filters

```go
filter := bson.D{
	{Key: "tenant_id", Value: tenantID},
	{Key: "status", Value: bson.D{{Key: "$in", Value: bson.A{"open", "paid"}}}},
	{Key: "created_at", Value: bson.D{{Key: "$gte", Value: from}, {Key: "$lt", Value: to}}},
	{Key: "deleted_at", Value: nil}, // matches a missing field or null: soft-deleted documents excluded
}
```

- Every query on tenant data has the tenant in its filter, from the caller's session (`sec-authz-every-route`), and the tenant is the first key of its indexes.
- On a soft-delete collection, every filter, `$lookup` and aggregation `$match` excludes deleted documents, as `db-soft-delete-filter` does for SQL.
- Keys and operators come from the code; values from typed request fields (`mongo-no-operator-injection`).
- Count with `CountDocuments(ctx, filter)` (accurate, uses the filter's index) or `EstimatedDocumentCount` (metadata, whole collection). Don't count to decide whether to insert: use a unique index.
- Existence check: `FindOne` with a `{_id: 1}` projection and `errors.Is(err, mongo.ErrNoDocuments)`.

## Updates

```go
res, err := s.customers().UpdateOne(ctx,
	bson.D{{Key: "_id", Value: id}, {Key: "tenant_id", Value: tenantID}, {Key: "version", Value: expected}},
	bson.D{
		{Key: "$set", Value: bson.D{{Key: "name", Value: name}, {Key: "updated_at", Value: now}}},
		{Key: "$inc", Value: bson.D{{Key: "version", Value: 1}}},
	},
)
if err != nil {
	return fmt.Errorf("rename customer: %w", err)
}
if res.MatchedCount == 0 {
	return customer.ErrStale // or ErrNotFound: re-read to tell them apart if the API needs it
}
```

- Update with operators (`$set`, `$inc`, `$push`, `$pull`, `$unset`), not read-modify-`ReplaceOne`: two concurrent writers otherwise lose each other's changes. An operator update on one document is atomic.
- **Optimistic concurrency:** a `version` field in the filter and `$inc` in the update, as above.
- **Read the result in one round trip:** `FindOneAndUpdate(ctx, filter, update, options.FindOneAndUpdate().SetReturnDocument(options.After))`.
- **Upsert:** `options.UpdateOne().SetUpsert(true)` with a filter on a unique-indexed key; `$setOnInsert` for fields only written on creation. Two concurrent upserts of a new key can both try to insert: one gets a duplicate-key error, and retrying it once updates the document the other inserted.
- **Arrays:** `$push` with `$slice` keeps an embedded array bounded; an array that grows without bound belongs in its own collection (the 16 MB document limit, `mongodb-schema-design`).
- `UpdateMany`/`DeleteMany` with an empty filter touches the whole collection: guard against an empty filter in code that builds filters dynamically.

## Bulk writes

```go
models := make([]mongo.WriteModel, 0, len(items))
for _, it := range items {
	models = append(models, mongo.NewUpdateOneModel().
		SetFilter(bson.D{{Key: "sku", Value: it.SKU}}).
		SetUpdate(bson.D{{Key: "$set", Value: bson.D{{Key: "name", Value: it.Name}, {Key: "price_cents", Value: it.PriceCents}}}}).
		SetUpsert(true))
}
_, err := s.items().BulkWrite(ctx, models, options.BulkWrite().SetOrdered(false))
```

- Batch in chunks (a few hundred to a few thousand models); the driver splits on the server's message size, but one huge slice holds everything in memory.
- `SetOrdered(false)` lets the server continue past a failed model and run in parallel; use ordered only when later models depend on earlier ones. On error, `errors.As(err, &bulkErr)` with `mongo.BulkWriteException` lists the failed indexes.
- `InsertMany` for plain inserts of new documents.

## Lists and pagination

Keyset pagination on a unique sort key, a capped limit and a projection (`mongo-bounded-reads`). For a sort on a non-unique field, page on the pair:

```go
// next page after (lastCreatedAt, lastID), newest first; index {tenant_id: 1, created_at: -1, _id: -1}
filter := bson.D{
	{Key: "tenant_id", Value: tenantID},
	{Key: "$or", Value: bson.A{
		bson.D{{Key: "created_at", Value: bson.D{{Key: "$lt", Value: lastCreatedAt}}}},
		bson.D{{Key: "created_at", Value: lastCreatedAt}, {Key: "_id", Value: bson.D{{Key: "$lt", Value: lastID}}}},
	}},
}
opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}, {Key: "_id", Value: -1}}).SetLimit(size)
```

The cursor the API returns is opaque (base64 of the last key), never a raw filter.

## Aggregation

- Pipelines are `mongo.Pipeline` (`[]bson.D`), built from stages the code names.
- `$match` and `$sort` first, so they can use an index; `$project`/`$limit` early to shrink documents; `$lookup` only on an indexed foreign field, and if most reads need one, reconsider the model (`mongodb-schema-design` references/antipattern-excessive-lookups.md).
- A pipeline over a large collection that sorts or groups in memory may need `options.Aggregate().SetAllowDiskUse(true)`: treat that as a signal to add an index or a precomputed field, not as the fix.
- Detailed stage ordering: `mongodb-query-optimizer` references/aggregation-optimization.md.

## Indexes

Declared in the store (`mongo-indexes-in-code`), named, compound in equality, sort, range order, tenant first. TTL indexes (`options.Index().SetExpireAfterSeconds(n)` on a date field) expire sessions, tokens and events. Partial indexes (`SetPartialFilterExpression`) keep a unique rule to live documents (`deleted_at: null`). Keep the count per collection small (`mongodb-schema-design` references/antipattern-unnecessary-indexes.md).
