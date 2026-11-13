---
name: go-database
description: "Use when writing, changing, reviewing or testing database access in a Go server on PostgreSQL: queries, scanning rows, transactions, upserts, soft deletes, IDs, where SQL lives, schema changes and migrations, and the pgx driver. Parameterised SQL only, SQL in the data-access layer, defer Rollback right after Begin, close rows and check rows.Err, every query with the request's context, deleted_at filtered in every query and join. Absorbs samber/cc-skills-golang@golang-database, adapted to the team (pgx v5, no ORM, no sqlx, no sqlmock). Holds the db-* rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode or similar harness, and for Go server projects on PostgreSQL.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# Go database access (team)

> **Absorbed.** This skill includes `samber/cc-skills-golang@golang-database` (MIT, Samuel Berthe; source and pinned commit in [UPSTREAM.md](UPSTREAM.md)), adapted to the team: the team's rules and decisions come first and win, and "In depth" holds the upstream material, edited where the team decided otherwise. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill.

Related: [go-security](../go-security/SKILL.md) (`sec-sql-parameterized`, `sec-authz-every-route`: scope every query to the caller), [go-testing](../go-testing/SKILL.md) (`test-real-database`), [go-project-layout](../go-project-layout/SKILL.md) (the Platform layer), [go-how-to](../go-how-to/SKILL.md) (the Go skills and the rules they all assume).

## When to use

- Adding or changing a query, a repository method or a typed accessor
- A transaction, an upsert, a soft delete, a new table or column
- Choosing where SQL goes, or how an ID is made
- Reviewing a Go diff that touches SQL

## The team's rules

- **Where SQL lives:** in the Platform database package or typed accessors there; Domain packages call those, Surface packages never hold SQL. If the project caps raw SQL per package, never raise a cap.
- **`$1` placeholders**, never string-built SQL. `ON CONFLICT` for upserts, `RETURNING` instead of a second read.
- **Soft-delete tables:** every query, joins too, filters `deleted_at IS NULL`.
- **IDs:** UUIDv7 (time-ordered) from one helper, unless the project says otherwise. Secrets are separate random columns, never IDs.
- **Schema changes** go through the project's migration tool, one migration per change, never edited after it ships. Generated schema code is regenerated, not hand-edited.
- **Transactions:** `defer tx.Rollback(ctx)` right after `Begin`; commit last.
- **Rows:** `defer rows.Close()`, then check `rows.Err()` after the loop.
- **Every query runs with the request's context** ([go-concurrency](../go-concurrency/SKILL.md)).

## Team decisions

1. **Driver:** `pgx` (v5) for PostgreSQL, through the project's database package. No ORM (upstream agrees), and no `sqlx`.
2. **No mocked database.** Database code is tested against a real PostgreSQL, one fresh database or schema per test (`test-real-database`); `go-sqlmock` is not adopted. testcontainers is fine where the project already uses it.
3. **PostgreSQL only:** write native PostgreSQL (`ON CONFLICT`, `RETURNING`, `jsonb`), not portable SQL.

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [db-close-rows](rules/db-close-rows.md) | Close rows and check rows.Err | HIGH | scan, lint (sqlclosecheck, rowserrcheck) |
| [db-soft-delete-filter](rules/db-soft-delete-filter.md) | Filter soft-deleted rows in every query and join | HIGH | review |
| [db-tx-defer-rollback](rules/db-tx-defer-rollback.md) | Defer Rollback right after Begin | HIGH | scan |
| [db-context-on-queries](rules/db-context-on-queries.md) | Run every query with the request's context | MEDIUM | scan |
| [db-sql-in-data-layer](rules/db-sql-in-data-layer.md) | Keep SQL in the data-access layer | LOW | scan (candidates) |

## Reviewing

1. **Scope:** the diff (`git diff <base>...HEAD -- '*.go'`), a merge request's files, or the whole module.
2. **Tools first**, from `<module-root>`: `gofmt -l .`, `go vet ./...`, and `golangci-lint run` when the project has a `.golangci.yml`. Report their findings as they are; a rule that names a linter isn't reported twice.
3. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check. On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
4. **Read** the code against the rules above, matching each rule's "Incorrect" shape, not just its title, and against the checklist below.
5. **Report** in the format of `agent-skills-authoring` ("Scan scripts and findings"), ordered by impact; list once, as a gap, the rules whose check is a test or linter the project doesn't have.

## Review checklist

- [ ] Parameterised SQL only (`sec-sql-parameterized`)
- [ ] SQL in the data-access layer; no SQL in handlers
- [ ] `deleted_at IS NULL` in every query and join on soft-delete tables
- [ ] `defer tx.Rollback` right after `Begin`; rows closed and `rows.Err()` checked
- [ ] Queries run with the request's context
- [ ] Schema change as a new migration; generated code regenerated

## In depth

The material below is `samber/cc-skills-golang@golang-database`, absorbed into this skill (source, pinned commit and licence in [UPSTREAM.md](UPSTREAM.md)) and edited where the team decided otherwise. The team's rules and decisions above win wherever the two still differ. Links of the form `samber/cc-skills-golang@<name>` name upstream skills: the ones absorbed are now team skills (`go-how-to` maps the names), the rest are vendored as `golang-*` or not adopted.

**Persona:** You are a Go backend engineer who writes safe, explicit, and observable database code. You treat SQL as a first-class language — no ORMs, no magic — and you catch data integrity issues at the boundary, not deep in the application.

**Modes:**

- **Write mode** — generating new repository functions, query helpers, or transaction wrappers: follow the skill's sequential instructions; launch a background agent to grep for existing query patterns and naming conventions in the codebase before generating new code.
- **Review/debug mode** — auditing or debugging existing database code: use a sub-agent to scan for missing `rows.Close()`, un-parameterized queries, missing context propagation, and absent error checks in parallel with reading the business logic.

The team writes PostgreSQL only, with `pgx` v5 (`pgxpool.Pool`, `pgx.Tx`) through the project's database package — never an ORM, and not `database/sql`, `sqlx` or portable SQL.

When using pgx, refer to its official documentation and code examples for current API signatures.

### Best Practices Summary

1. **Use pgx, not ORMs** — ORMs hide SQL, generate unpredictable queries, and make debugging harder
2. Queries MUST use parameterized placeholders (`$1`, `$2`, …) — NEVER concatenate user input into SQL strings
3. Context MUST be passed to all database operations — every pgx call takes a `ctx`: pass the caller's, never `context.Background()` inside a request
4. `pgx.ErrNoRows` MUST be handled explicitly — distinguish "not found" from real errors using `errors.Is`
5. Rows MUST be closed after iteration — `defer rows.Close()` immediately after `Query` (or let `pgx.CollectRows` close them)
6. NEVER use `Query` for statements that don't return rows — `Query` returns `pgx.Rows`, which must be closed; if you forget, the connection is never released to the pool. Use `Exec` instead (its `pgconn.CommandTag` gives `RowsAffected()`)
7. **Use transactions for multi-statement operations** — wrap related writes in `Begin`/`Commit`, with `defer tx.Rollback(ctx)` right after `Begin`
8. **Use `SELECT ... FOR UPDATE`** when reading data you intend to modify — prevents race conditions
9. **Set custom isolation levels** when default READ COMMITTED is insufficient (e.g., serializable for financial operations)
10. **Handle NULLable columns** with pointer fields (`*string`, `*int`) or `pgtype` types (`pgtype.Text`, `pgtype.Timestamptz`)
11. Connection pool MUST be configured — `pgxpool.Config`: `MaxConns`, `MinConns`, `MaxConnLifetime`, `MaxConnIdleTime`
12. **Migrations go through the project's migration tool** — one new migration per change, written and reviewed by a human, never edited after it ships
13. **Batch operations in reasonable sizes** — not row-by-row (too many round trips), not millions at once (locks and memory); `pgx.Batch` or `CopyFrom`
14. **Treat schema changes with care** — a schema that looks correct on toy data can create hotspots, lock contention, or missing indexes under real production load. Schema design requires understanding of data volumes, access patterns, and production constraints that AI does not have: propose the migration, and let a human who knows the data review it
15. **Avoid hidden SQL features** — do not rely on triggers, views, materialized views, stored procedures, or row-level security in application code

### Library Choice

| Library | Status | Struct scanning | PostgreSQL-specific |
| --- | --- | --- | --- |
| `pgx` v5 (`pgxpool`) | **Adopted** — PostgreSQL native, faster than `database/sql` | `pgx.CollectRows` + `pgx.RowToStructByName` | Yes (COPY, LISTEN, arrays, `pgx.Batch`) |
| `database/sql`, `sqlx` | Not adopted — portability the team doesn't need | Manual `Scan` / `StructScan` | No |
| GORM/ent | **Avoid** | Magic | Abstracted away |

**Why NOT ORMs:**

- Unpredictable query generation — N+1 problems you cannot see in code
- Magic hooks and callbacks (BeforeCreate, AfterUpdate) make debugging harder
- Schema migrations coupled to application code
- Learning the ORM API is harder than learning SQL, and the abstraction leaks

### Parameterized Queries

```go
// ✗ VERY BAD — SQL injection vulnerability
query := fmt.Sprintf("SELECT * FROM users WHERE email = '%s'", email)

// ✓ Good — parameterized
rows, err := pool.Query(ctx, "SELECT id, name, email FROM users WHERE email = $1 AND deleted_at IS NULL", email)
if err != nil {
    return fmt.Errorf("querying user: %w", err)
}
user, err := pgx.CollectOneRow(rows, pgx.RowToStructByName[User])
```

#### Dynamic IN clauses

Pass the list as one array parameter with `= ANY($1)`; pgx encodes a Go slice as a PostgreSQL array, so the SQL text never changes with the list length and an empty slice simply matches no rows:

```go
rows, err := pool.Query(ctx,
    "SELECT id, name, email FROM users WHERE id = ANY($1) AND deleted_at IS NULL", ids)
if err != nil {
    return nil, fmt.Errorf("querying users: %w", err)
}
users, err := pgx.CollectRows(rows, pgx.RowToStructByName[User])
```

#### Dynamic column names

Never interpolate column names from user input. Use an allowlist:

```go
allowed := map[string]bool{"name": true, "email": true, "created_at": true}
if !allowed[sortCol] {
    return fmt.Errorf("invalid sort column: %s", sortCol)
}
query := fmt.Sprintf("SELECT id, name, email FROM users ORDER BY %s", sortCol)
```

For more injection prevention patterns, see the `go-security` skill.

### Struct Scanning and NULLable Columns

Use `pgx.CollectRows` (or `pgx.CollectOneRow`) with `pgx.RowToStructByName`, which matches columns to fields by name or by a `db:"column_name"` tag. Handle NULLable columns with pointer fields (`*string`, `*time.Time`) — they work cleanly with both scanning and JSON marshaling. See [Scanning Reference](./references/scanning.md) for examples of all approaches.

### Error Handling

```go
func GetUser(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) (*User, error) {
    var user User

    err := pool.QueryRow(ctx,
        "SELECT id, name FROM users WHERE id = $1 AND deleted_at IS NULL", id,
    ).Scan(&user.ID, &user.Name)
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, ErrUserNotFound // translate to domain error
        }
        return nil, fmt.Errorf("querying user %s: %w", id, err)
    }

    return &user, nil
}
```

or:

```go
func GetUser(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID) (u *User, exists bool, err error) {
    var user User

    err = pool.QueryRow(ctx,
        "SELECT id, name FROM users WHERE id = $1 AND deleted_at IS NULL", id,
    ).Scan(&user.ID, &user.Name)
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return nil, false, nil // "no user" is not a technical error, but a domain error
        }
        return nil, false, fmt.Errorf("querying user %s: %w", id, err)
    }

    return &user, true, nil
}
```

#### Always close rows

```go
rows, err := pool.Query(ctx, "SELECT id, name FROM users WHERE deleted_at IS NULL")
if err != nil {
    return fmt.Errorf("querying users: %w", err)
}
defer rows.Close() // releases the connection to the pool

for rows.Next() {
    // ...
}
if err := rows.Err(); err != nil { // always check after iteration
    return fmt.Errorf("iterating users: %w", err)
}
```

`pgx.CollectRows` does the loop, the close and the `rows.Err()` check for you; prefer it unless you need row-by-row control.

#### Common database error patterns

| Error | How to detect | Action |
| --- | --- | --- |
| Row not found | `errors.Is(err, pgx.ErrNoRows)` | Return domain error |
| Unique constraint | `errors.As(err, &pgErr)` with `*pgconn.PgError`, `pgErr.Code == "23505"` (`pgerrcode.UniqueViolation`) | Return conflict error |
| Connection refused | `err != nil` on `pool.Ping(ctx)` | Fail fast, log, retry with backoff |
| Serialization failure | PostgreSQL error code `40001` | Retry the entire transaction |
| Context canceled | `errors.Is(err, context.Canceled)` | Stop processing, propagate |

### Context Propagation

Every pgx call takes a context; pass the caller's so deadlines and cancellation reach the query:

```go
// ✗ Bad — detached context, query runs until completion even if client disconnects
pool.Query(context.Background(), "SELECT ...")

// ✓ Good — respects context cancellation and timeouts
pool.Query(ctx, "SELECT ...")
```

For context patterns in depth, see the `golang-context` skill.

### Transactions, Isolation Levels, and Locking

For transaction patterns, isolation levels, `SELECT FOR UPDATE`, and locking variants, see [Transactions](./references/transactions.md).

### Connection Pool

```go
cfg, err := pgxpool.ParseConfig(dsn)
if err != nil {
    return nil, fmt.Errorf("parsing database config: %w", err)
}
cfg.MaxConns = 25                       // limit total connections
cfg.MinConns = 2                        // keep warm connections ready
cfg.MaxConnLifetime = 5 * time.Minute   // recycle stale connections
cfg.MaxConnIdleTime = 1 * time.Minute   // close idle connections faster
pool, err := pgxpool.NewWithConfig(ctx, cfg)
```

For sizing guidance and formulas, see [Database Performance](./references/performance.md).

### Migrations

Use the project's migration tool: one new migration per change, never edited after it ships. Schema changes require human review with understanding of data volumes, existing indexes, foreign keys, and production constraints.

If a project has no tool yet, common choices are:

- [golang-migrate](https://github.com/golang-migrate/migrate) — CLI + Go library
- [Atlas](https://atlasgo.io/) — modern, declarative schema management
- [Flyway](https://flywaydb.org/) — JVM-based, widely used in enterprise environments

Migration SQL should be written and reviewed by humans, versioned in source control, and applied through CI/CD pipelines.

### Avoid Hidden SQL Features

Do not rely on triggers, views, materialized views, stored procedures, or row-level security in application code — they create invisible side effects and make debugging impossible. Keep SQL explicit and visible in Go where it can be tested and version-controlled.

### Schema Creation

**This skill covers the conventions for a new table or column (the team's rules above), not schema design.** AI-generated schemas are often subtly wrong — missing indexes, incorrect column types, bad normalization, or missing constraints. Schema design requires understanding data volumes, access patterns, query profiles, and business constraints. Write the change as a migration through the project's tool and have a human review it.

### Deep Dives

- **[Transactions](./references/transactions.md)** — Transaction boundaries, isolation levels, deadlock prevention, `SELECT FOR UPDATE`
- **[Testing Database Code](./references/testing.md)** — A real PostgreSQL per test through a `dbtest` helper, hand-written fakes for service tests, what to test where
- **[Database Performance](./references/performance.md)** — Connection pool sizing, batch processing, indexing strategy, query optimization
- **[Struct Scanning](./references/scanning.md)** — Struct tags, NULLable column handling, JSON marshaling patterns

### Cross-References

- → See `go-security` skill for SQL injection prevention patterns
- → See `golang-context` skill for context propagation to database operations
- → See `go-error-handling` skill for database error wrapping patterns
- → See `go-testing` skill for database integration test patterns

### References

- [pgx](https://github.com/jackc/pgx)
- [pgxpool](https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool)
- [golang-migrate](https://github.com/golang-migrate/migrate)
