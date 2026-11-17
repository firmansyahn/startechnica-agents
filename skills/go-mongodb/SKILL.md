---
name: go-mongodb
description: "Use when writing, changing, reviewing or testing MongoDB access in a Go service with the official driver (go.mongodb.org/mongo-driver/v2): connecting and the settings block, logging in (required; TLS optional, PLAIN only over TLS), the app name, the one Client and its pool, timeouts (CSOT, context deadlines), document structs and bson tags, filters, updates, upserts, bulk writes, aggregation, cursors, pagination, indexes, transactions, write and read concerns, change streams, OpenTelemetry (otelmongo), tests against a real MongoDB, and migrating from driver v1 to v2. One Client per process, every call with the request's context, cursors closed, filters from typed values (no operator injection), driver errors translated in the store, an index declared for every query, bounded keyset pages, WithTransaction with its own context. Names the vendored mongodb-schema-design and mongodb-query-optimizer skills. Holds the mongo-* rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects on MongoDB with mongo-driver v2.
metadata:
  author: firmansyahn
  version: "0.2.0"
---

# Go and MongoDB (team)

**Principle:** One long-lived client in the data-access layer, every operation bounded by the caller's context, every query typed, scoped and backed by an index the code declares.

The team talks to MongoDB with the official Go driver, v2 (`go.mongodb.org/mongo-driver/v2`). Read `go.mod` first: a project still on v1 (`go.mongodb.org/mongo-driver`) keeps v1's API until it migrates ("Migrating from v1"). The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill ([go-how-to](../go-how-to/SKILL.md), rule 1).

Two of MongoDB's official agent skills are vendored beside this one, unchanged: [mongodb-schema-design](../mongodb-schema-design/SKILL.md) (embed or reference, document size, patterns, schema validation) and [mongodb-query-optimizer](../mongodb-query-optimizer/SKILL.md) (indexes for slow queries, explain, aggregation order). Open them for those questions; where they differ from the team, this skill wins ("Team decisions").

Related: [go-database](../go-database/SKILL.md) (the same stance for PostgreSQL: data-access layer, contexts, soft deletes, IDs), [go-concurrency](../go-concurrency/SKILL.md) (contexts, workers, shutdown), [go-testing](../go-testing/SKILL.md) (`test-real-database`), [go-security](../go-security/SKILL.md) (`sec-authz-every-route`, `sec-no-secrets-in-logs`), [go-error-handling](../go-error-handling/SKILL.md), [go-observability](../go-observability/SKILL.md), [go-project-layout](../go-project-layout/SKILL.md) (the Platform layer), [go-knadh-koanf](../go-knadh-koanf/SKILL.md) (the `mongodb` settings block).

## When to use

- Connecting a service to MongoDB, or changing the client's pool, timeouts or concerns
- Adding or changing a store method: a find, an update, an upsert, a bulk write, an aggregation
- A new collection, field or index; a list endpoint and its pagination
- A transaction, an outbox, a change stream
- A test for MongoDB code; a timeout, pool or slow-query problem
- Moving from driver v1 to v2
- Reviewing a Go diff that imports `go.mongodb.org/mongo-driver`

## The team's rules

- **Where it lives:** one Platform package owns MongoDB (`internal/platform/mongostore` or the project's equivalent): the Client, the collections, the document structs, the indexes. Domain packages call its methods; Surface packages never import the driver.
- **One Client per process**, opened and pinged in `run()`, injected, disconnected once on shutdown (`mongo-one-client`).
- **Login is required, TLS is optional:** every client logs in, in every environment, with credentials from the settings' `auth` block or the URI; the store refuses options without a login. Without TLS the mechanism is SCRAM; PLAIN only over TLS. The server has authorization on and gives the service one least-privilege user (`mongo-authenticated-connection`).
- **App name required:** every client sets `SetAppName` with the service's name from the settings, the same on every replica; it labels connections in the server's logs and `currentOp`, and is not an identity (`mongo-app-name`).
- **Every call takes the caller's `ctx`**, and the Client sets `SetTimeout` for calls without a deadline (`mongo-context-deadline`).
- **Cursors** are read with `cur.All` or closed with `defer cur.Close(ctx)` and checked with `cur.Err()` (`mongo-close-cursor`).
- **Filters and updates are built from typed values** under keys the code names; no request document becomes a filter, an update or a pipeline; no `$where` (`mongo-no-operator-injection`).
- **Tenant data** has the tenant in every filter and first in every index; soft-delete collections exclude deleted documents in every read, as `db-soft-delete-filter` does for SQL.
- **Driver errors are translated in the store:** not found, conflict, stale (`mongo-translate-driver-errors`).
- **Every query has an index declared in code**, uniqueness is a unique index (`mongo-indexes-in-code`).
- **Lists are bounded:** a capped limit, a projection, keyset pagination (`mongo-bounded-reads`).
- **Transactions only when several documents must change together**, through `WithTransaction` with the callback's context (`mongo-with-transaction`).

## Team decisions

1. **Driver:** the official `go.mongodb.org/mongo-driver/v2`, used directly through the store package.

   | Library | Status | Why |
   |---|---|---|
   | `go.mongodb.org/mongo-driver/v2` | **Adopted** | Official, maintained by MongoDB, implements the driver specs (CSOT, retryable reads and writes, sessions, CMAP pool). |
   | `go.mongodb.org/mongo-driver` (v1) | Existing code only | Maintenance only; new code and upgrades go to v2. |
   | ODMs (`mgm`, `qmgo`, `mongox`, …) | **Not adopted** | Hide the queries the same way an ORM hides SQL (`go-database`, decision 1), lag the driver, add hooks. |
   | `mgo`, `globalsign/mgo` | **Never** | Unmaintained, no support for current servers. |

2. **No mocked driver.** Store code is tested against a real MongoDB, a single-node replica set, one fresh database per test (references/testing.md, `test-real-database`). Interface fakes of the store are for the services above it.
3. **Concerns:** `writeconcern.Majority()` on the Client; reads from the primary. Secondary reads only for reads that tolerate stale data, set per collection (references/consistency.md).
4. **IDs:** `_id` is a `bson.ObjectID` made in code (`bson.NewObjectID()`), unless the project already uses UUIDv7 across its stores. Secrets are separate random fields, never IDs.
5. **Schema and indexes change through code review:** indexes and validators are declared in the store's `EnsureIndexes` or the project's migration step, never made by hand in one environment. The vendored skills' MCP workflows are for reading (explain, indexes, sample documents, Performance Advisor); an agent never creates or drops an index, validator or collection through an MCP server, even with approval: it writes the change into the code.
6. **Observability:** traces through `otelmongo.NewMonitor()` on the Client; pool events counted as metrics; the driver's own logger off unless debugging; the service logs with zap (`go-observability`). No command documents in logs.
7. **Settings** come from the `mongodb` block of the service's config (koanf): the URI (hosts, replica set, TLS options), the app name, the database, and the login in an `auth` block with a mounted `password_file`, or in the URI, which is then a secret read from `uri_file` ([references/connection.md](references/connection.md), "Settings").

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [mongo-no-operator-injection](rules/mongo-no-operator-injection.md) | Build filters and updates from typed values, never from request documents | CRITICAL | scan (candidates), review |
| [mongo-authenticated-connection](rules/mongo-authenticated-connection.md) | Always log in; TLS is optional, PLAIN only over it | CRITICAL | scan (candidates), test, review |
| [mongo-one-client](rules/mongo-one-client.md) | Create one Client per process and disconnect it on shutdown | HIGH | scan (candidates), review |
| [mongo-context-deadline](rules/mongo-context-deadline.md) | Run every operation with the request's context and a client-wide timeout | HIGH | scan, review |
| [mongo-close-cursor](rules/mongo-close-cursor.md) | Close every cursor and check its error | HIGH | scan, review |
| [mongo-indexes-in-code](rules/mongo-indexes-in-code.md) | Declare the index every query needs, in code or a migration | HIGH | test, review |
| [mongo-with-transaction](rules/mongo-with-transaction.md) | Run multi-document transactions through WithTransaction with its context | HIGH | scan, review |
| [mongo-translate-driver-errors](rules/mongo-translate-driver-errors.md) | Translate ErrNoDocuments and duplicate keys into domain errors in the store | MEDIUM | scan (candidates), review |
| [mongo-bounded-reads](rules/mongo-bounded-reads.md) | Bound every list read with a limit, a projection and keyset pagination | MEDIUM | scan (candidates), review |
| [mongo-app-name](rules/mongo-app-name.md) | Name every client with the service's app name | MEDIUM | scan (candidates), test, review |

## Reviewing

1. **Scope:** the diff (`git diff <base>...HEAD -- '*.go'`), a merge request's files, or the whole module.
2. **Tools first**, from `<module-root>`: `gofmt -l .`, `go vet ./...`, and `golangci-lint run` when the project has a `.golangci.yml`. Report their findings as they are.
3. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check (`MONGO_DIRS` names the folders where the driver belongs). On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
4. **Read** the code against the rules above, matching each rule's "Incorrect" shape, and against the checklist below. For a new query, find its index; for a new document field, check its `bson` tag and `omitempty`.
5. **Report** in the format of [agent-skills-authoring](../agent-skills-authoring/SKILL.md) ("Scan scripts and findings"), ordered by impact; list once, as a gap, the rules whose check is a test the project doesn't have (`mongo-indexes-in-code`).

## Review checklist

- [ ] No request document used as a filter, update, sort or pipeline; no `$where`/`$function`
- [ ] Tenant in every filter; soft-deleted documents excluded
- [ ] Every client logs in: credentials in the `auth` block or the URI, never neither; PLAIN only with TLS; no literal URI in code
- [ ] `SetAppName` with the service's name from the settings; `validate` refuses an empty `app_name`
- [ ] One Client, injected, disconnected on shutdown; `SetTimeout` set
- [ ] Every call with the caller's `ctx`; background work with its own deadline
- [ ] Cursors read with `All` or closed and `Err()` checked
- [ ] `ErrNoDocuments`, duplicate keys and zero `MatchedCount` translated to domain errors
- [ ] Each new filter and sort has a declared, named index; uniqueness is a unique index
- [ ] Lists have a capped limit, a projection and a keyset cursor
- [ ] Transactions use `WithTransaction`, the callback's `ctx`, and no side effects outside MongoDB
- [ ] Every document field has a `bson` tag; no `omitempty` on counters, flags or amounts; money not `float64`
- [ ] Tests run against a real MongoDB replica set

## The store package

```go
// internal/platform/mongostore/store.go
type Store struct {
	client *mongo.Client
	db     *mongo.Database
}

func Open(ctx context.Context, cfg config.MongoDB) (*Store, error) {
	// URI or uri_file, the login (refused when missing), app name, timeouts, pool, majority writes
	opts, err := ClientOptions(cfg) // references/connection.md
	if err != nil {
		return nil, err
	}
	client, err := mongo.Connect(opts.SetMonitor(otelmongo.NewMonitor()))
	if err != nil {
		return nil, fmt.Errorf("mongodb connect: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, readpref.Primary()); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, fmt.Errorf("mongodb ping: %w", err)
	}
	return &Store{client: client, db: client.Database(cfg.Database)}, nil
}

func (s *Store) Close(ctx context.Context) error { return s.client.Disconnect(ctx) }

func (s *Store) customers() *mongo.Collection { return s.db.Collection("customers") }
```

Settings, pool sizing, timeouts, health probes, shutdown order and driver logging: [references/connection.md](references/connection.md).

## A store method

```go
func (s *Store) GetCustomer(ctx context.Context, tenantID string, id bson.ObjectID) (customer.Customer, error) {
	var doc customerDoc
	err := s.customers().FindOne(ctx, bson.D{
		{Key: "_id", Value: id},
		{Key: "tenant_id", Value: tenantID},
		{Key: "deleted_at", Value: nil},
	}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return customer.Customer{}, customer.ErrNotFound
	}
	if err != nil {
		return customer.Customer{}, fmt.Errorf("get customer %s: %w", id.Hex(), err)
	}
	return doc.toDomain(), nil
}

func (s *Store) CreateCustomer(ctx context.Context, c customer.Customer) (bson.ObjectID, error) {
	doc := customerDocFrom(c)
	doc.ID = bson.NewObjectID()
	if _, err := s.customers().InsertOne(ctx, doc); err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return bson.ObjectID{}, customer.ErrEmailTaken
		}
		return bson.ObjectID{}, fmt.Errorf("insert customer: %w", err)
	}
	return doc.ID, nil
}
```

- `bson.D` (ordered) for filters, updates, sorts, projections and index keys; `bson.M` only where order can't matter.
- Updates use operators (`$set`, `$inc`), not read-modify-replace; `FindOneAndUpdate` with `options.After` returns the new document in one round trip.
- Document structs, `omitempty` traps, time and money, updates, upserts, bulk writes, pagination on non-unique sorts, aggregation and index kinds: [references/documents.md](references/documents.md).

## Indexes

```go
func (s *Store) EnsureIndexes(ctx context.Context) error {
	_, err := s.customers().Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "tenant_id", Value: 1}, {Key: "email", Value: 1}},
			Options: options.Index().SetName("customers_tenant_email_unique").SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "tenant_id", Value: 1}, {Key: "created_at", Value: -1}, {Key: "_id", Value: -1}},
			Options: options.Index().SetName("customers_tenant_created"),
		},
	})
	if err != nil {
		return fmt.Errorf("create customer indexes: %w", err)
	}
	return nil
}
```

Run at startup for small collections, or as a migration step for large ones; equality fields first, then sort, then range. Which index a slow query needs: [mongodb-query-optimizer](../mongodb-query-optimizer/SKILL.md).

## Transactions and change streams

```go
sess, err := s.client.StartSession()
if err != nil {
	return fmt.Errorf("start session: %w", err)
}
defer sess.EndSession(ctx)

_, err = sess.WithTransaction(ctx, func(ctx context.Context) (any, error) {
	if _, err := s.orders().InsertOne(ctx, o); err != nil {
		return nil, fmt.Errorf("insert order: %w", err)
	}
	if _, err := s.outbox().InsertOne(ctx, orderPlaced(o)); err != nil {
		return nil, fmt.Errorf("insert outbox event: %w", err)
	}
	return nil, nil
})
```

Concerns and read preference, transaction limits, the outbox, and change streams with saved resume tokens: [references/consistency.md](references/consistency.md).

## Testing

A single-node replica set from testcontainers-go's `modules/mongodb` (`mongodb.Run(ctx, "mongo:8.0", mongodb.WithReplicaSet("rs0"))`) or a CI service, one random database per test, the service's own `EnsureIndexes`, and `explain` to assert index use: [references/testing.md](references/testing.md).

## Migrating from v1

| v1 | v2 |
|---|---|
| `mongo.Connect(ctx, opts)` | `mongo.Connect(opts)`; check reachability with `Ping` |
| `bson/primitive` (`primitive.ObjectID`, `primitive.Decimal128`, `primitive.D`) | All in `bson` (`bson.ObjectID`, `bson.Decimal128`, `bson.D`) |
| `SetSocketTimeout`, `SetMaxTime`, `SetMaxCommitTime`, `WTimeout` | Removed: `SetTimeout` on the Client and context deadlines |
| `mongo.SessionContext`, `WithTransaction(ctx, func(sc mongo.SessionContext) (interface{}, error))` | A plain `context.Context`: `func(ctx context.Context) (any, error)` |
| `*options.FindOptions` structs passed directly | Builders (`options.Find().SetLimit(…)`), taken as `options.Lister[…]` |
| `options.Update()` | `options.UpdateOne()`, `options.UpdateMany()` |
| `Cursor.SetMaxTime` | `Cursor.SetMaxAwaitTime` (tailable cursors only) |
| `otelmongo` under `.../go.mongodb.org/mongo-driver/mongo/otelmongo` | `.../go.mongodb.org/mongo-driver/v2/mongo/otelmongo` |

Migrate one module at a time, run the store tests against a real server after each step, and read the driver's migration guide (`docs/migration-2.0.md` in the driver repository) for the full list. Current v2 releases need a recent Go toolchain and MongoDB 4.4 or later: check the release notes against the project's `go.mod` and servers.

## References

- [Go driver documentation](https://www.mongodb.com/docs/drivers/go/current/) and [API on pkg.go.dev](https://pkg.go.dev/go.mongodb.org/mongo-driver/v2/mongo)
- [Client-side operation timeout](https://www.mongodb.com/docs/drivers/go/current/connect/connection-options/csot/)
- [Driver v2 migration guide](https://github.com/mongodb/mongo-go-driver/blob/master/docs/migration-2.0.md)
- [MongoDB agent skills](https://github.com/mongodb/agent-skills) (two vendored here; `mongodb-connection` has per-workload pool tables)
- [otelmongo for driver v2](https://pkg.go.dev/go.opentelemetry.io/contrib/instrumentation/go.mongodb.org/mongo-driver/v2/mongo/otelmongo), [testcontainers-go MongoDB module](https://golang.testcontainers.org/modules/mongodb/)
