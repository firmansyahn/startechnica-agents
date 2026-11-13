# Testing Database Code

The team tests database code against a real PostgreSQL, one fresh database per test, in plain `go test ./...` (`test-real-database` in [go-testing](../../go-testing/SKILL.md)). Business logic above the data layer is tested with hand-written fakes of small interfaces. Standard library `testing` only.

## Table of Contents

- [What to Test Where](#what-to-test-where)
- [A Real Database per Test](#a-real-database-per-test)
  - [The dbtest helper](#the-dbtest-helper)
  - [Repository tests](#repository-tests)
  - [Constraints, soft deletes and transactions](#constraints-soft-deletes-and-transactions)
  - [Running in CI](#running-in-ci)
- [Service-Layer Tests with Hand-Written Fakes](#service-layer-tests-with-hand-written-fakes)
- [What the Team Does Not Use](#what-the-team-does-not-use)
- [Rules](#rules)

## What to Test Where

| What                       | Service test (fake) | Database test (real PostgreSQL) |
| -------------------------- | :-----------------: | :-----------------------------: |
| Business logic             |          ✓          |                                 |
| SQL correctness            |                     |                ✓                |
| Error paths (not found)    |          ✓          |                ✓                |
| Transaction boundaries     |                     |                ✓                |
| NULL handling round-trips  |                     |                ✓                |
| Constraint violations      |                     |                ✓                |
| Soft-delete filtering      |                     |                ✓                |
| Tenant / owner scoping     |                     |                ✓                |
| Query performance          |                     |        ✓ (with `EXPLAIN`)       |

Every function that runs SQL has a database test. A fake never stands in for SQL: it can't tell you a column is misspelled, a join drops rows or a `deleted_at IS NULL` is missing.

## A Real Database per Test

### The dbtest helper

The project's database package has a test helper package (for example `database/dbtest`) whose `Open(t)` returns a handle to a fresh, migrated database and drops it when the test ends:

```go
db := dbtest.Open(t) // fresh, migrated, dropped on cleanup
```

How the helper gets a server:

- **CI:** a DSN from an environment variable (the project names it, e.g. `TEST_DATABASE_URL`), pointing at a PostgreSQL service in the job.
- **Locally:** the same variable, or, when it's unset, a throwaway local server the helper starts once per test binary (an embedded PostgreSQL binary, or `testcontainers-go` where the project already uses it) and stops when the binary exits.

A sketch of `Open`, with migrations applied once to a template database and each test cloning it (cloning is much faster than migrating per test):

```go
package dbtest

var (
    once     sync.Once
    adminDSN string
    initErr  error
)

// Open returns a pool on a fresh database cloned from the migrated template.
// The database is dropped when the test ends.
func Open(t testing.TB) *pgxpool.Pool {
    t.Helper()
    once.Do(func() { adminDSN, initErr = prepareTemplate() }) // server + migrations, once per binary
    if initErr != nil {
        t.Fatalf("dbtest: %v", initErr)
    }

    ctx := context.Background()
    admin, err := pgx.Connect(ctx, adminDSN)
    if err != nil {
        t.Fatalf("dbtest: connect: %v", err)
    }
    defer admin.Close(ctx)

    name := "test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
    // Identifiers can't be placeholders; name is generated here, never input.
    if _, err := admin.Exec(ctx, "CREATE DATABASE "+name+" TEMPLATE "+templateName); err != nil {
        t.Fatalf("dbtest: create database: %v", err)
    }

    pool, err := pgxpool.New(ctx, withDatabase(adminDSN, name))
    if err != nil {
        t.Fatalf("dbtest: open %s: %v", name, err)
    }
    t.Cleanup(func() {
        pool.Close()
        admin, err := pgx.Connect(context.Background(), adminDSN)
        if err != nil {
            t.Errorf("dbtest: connect for drop: %v", err)
            return
        }
        defer admin.Close(context.Background())
        if _, err := admin.Exec(context.Background(), "DROP DATABASE "+name+" WITH (FORCE)"); err != nil {
            t.Errorf("dbtest: drop %s: %v", name, err)
        }
    })
    return pool
}
```

`prepareTemplate` starts or finds the server, creates the template database, runs the project's migrations on it and closes every connection to it (PostgreSQL refuses to clone a database that has open connections). If the server ever complains about concurrent clones, serialise the `CREATE DATABASE` with a mutex.

The helper package also holds small fixture builders (`dbtest.User(t, db, "Alice")`, `dbtest.Tenant(t, db)`) that insert through the real data-access code or plain SQL and return the created row, so each test states the data it needs.

Never skip silently when no database is available: in CI that turns a broken setup into a green pipeline. Fail with a message that names the variable to set.

### Repository tests

```go
func TestUserStore_CreateAndGet(t *testing.T) {
    t.Parallel() // safe: each test has its own database
    db := dbtest.Open(t)
    store := NewUserStore(db)
    ctx := t.Context()

    created, err := store.Create(ctx, NewUser{Name: "Alice", Email: "alice@example.com"})
    if err != nil {
        t.Fatalf("Create: %v", err)
    }

    got, err := store.UserByID(ctx, created.ID)
    if err != nil {
        t.Fatalf("UserByID: %v", err)
    }
    if got.Name != "Alice" || got.Email != "alice@example.com" {
        t.Errorf("UserByID = %+v, want Alice <alice@example.com>", got)
    }
}

func TestUserStore_UserByID_NotFound(t *testing.T) {
    t.Parallel()
    db := dbtest.Open(t)

    _, err := NewUserStore(db).UserByID(t.Context(), uuid.Must(uuid.NewV7()))
    if !errors.Is(err, ErrUserNotFound) {
        t.Fatalf("UserByID error = %v, want ErrUserNotFound", err)
    }
}
```

Table-driven cases share one database only when they don't run in parallel; otherwise give each subtest its own `dbtest.Open(t)`.

### Constraints, soft deletes and transactions

These are the cases a fake can never cover, so each gets a database test:

```go
func TestUserStore_Create_DuplicateEmail(t *testing.T) {
    t.Parallel()
    db := dbtest.Open(t)
    store := NewUserStore(db)
    ctx := t.Context()

    if _, err := store.Create(ctx, NewUser{Name: "Alice", Email: "a@example.com"}); err != nil {
        t.Fatalf("first Create: %v", err)
    }
    _, err := store.Create(ctx, NewUser{Name: "Alice 2", Email: "a@example.com"})
    if !errors.Is(err, ErrEmailTaken) { // the unique violation (23505) translated to a domain error
        t.Fatalf("second Create error = %v, want ErrEmailTaken", err)
    }
}

func TestUserStore_List_HidesSoftDeleted(t *testing.T) {
    t.Parallel()
    db := dbtest.Open(t)
    store := NewUserStore(db)
    ctx := t.Context()

    dbtest.User(t, db, "Alice")
    bob := dbtest.User(t, db, "Bob")
    if err := store.Delete(ctx, bob.ID); err != nil { // sets deleted_at
        t.Fatalf("Delete: %v", err)
    }

    got, err := store.List(ctx)
    if err != nil {
        t.Fatalf("List: %v", err)
    }
    if len(got) != 1 || got[0].Name != "Alice" {
        t.Fatalf("List = %+v, want only Alice", got)
    }
}
```

For a transaction, make a later statement fail (a constraint, a cancelled context) and check that nothing from the earlier statements is left in the database. For NULLable columns, write a row with the column NULL and with a value, and read both back.

### Running in CI

The tests run in the normal test job, with no build tag and no separate target, so they block the merge like every other test. In GitLab CI the job gets PostgreSQL as a service and the DSN as a variable:

```yaml
go-test:
  image: golang:1.25
  services:
    - name: postgres:17-alpine
      alias: postgres
  variables:
    POSTGRES_PASSWORD: test
    TEST_DATABASE_URL: postgres://postgres:test@postgres:5432/postgres?sslmode=disable
  script:
    - go test -race ./...
```

Use the PostgreSQL major version production runs. The user in the DSN needs `CREATEDB`.

## Service-Layer Tests with Hand-Written Fakes

The consumer declares the small interface it needs; the database-backed store satisfies it, and the test supplies a fake written by hand:

```go
// In the service package: only what this service calls.
type userStore interface {
    UserByID(ctx context.Context, id uuid.UUID) (User, error)
}

type UserService struct {
    users userStore
}

// In the test file.
type fakeUserStore struct {
    users map[uuid.UUID]User
    err   error // returned by every call when set
    calls int
}

func (f *fakeUserStore) UserByID(_ context.Context, id uuid.UUID) (User, error) {
    f.calls++
    if f.err != nil {
        return User{}, f.err
    }
    u, ok := f.users[id]
    if !ok {
        return User{}, ErrUserNotFound
    }
    return u, nil
}

func TestUserService_GetUser(t *testing.T) {
    id := uuid.Must(uuid.NewV7())
    store := &fakeUserStore{users: map[uuid.UUID]User{id: {ID: id, Name: "Alice"}}}
    svc := &UserService{users: store}

    got, err := svc.GetUser(t.Context(), id)
    if err != nil {
        t.Fatalf("GetUser: %v", err)
    }
    if got.Name != "Alice" {
        t.Errorf("GetUser name = %q, want %q", got.Name, "Alice")
    }
}

func TestUserService_GetUser_NotFound(t *testing.T) {
    svc := &UserService{users: &fakeUserStore{}}

    _, err := svc.GetUser(t.Context(), uuid.Must(uuid.NewV7()))
    if !errors.Is(err, ErrUserNotFound) {
        t.Fatalf("GetUser error = %v, want ErrUserNotFound", err)
    }
}
```

Service tests verify business logic, not SQL. They run fast and need no database; the store's own SQL is covered by its database tests.

## What the Team Does Not Use

- **SQL mocks** (`go-sqlmock` and similar): they assert on query text, so they pass while the real query has a typo, a missing column or a wrong join, and fail on harmless rewrites.
- **Assertion and suite libraries:** the standard library's `t.Fatalf`/`t.Errorf` with `got`/`want` messages, and `t.Cleanup` instead of suite setup and teardown hooks.
- **Mock generators:** fakes are written by hand against interfaces of one to three methods.
- **Build-tag gating** (`//go:build integration`) by default: database tests are ordinary tests.
- **testcontainers** only where the project already uses it; it is one way for the helper to get a server, not a second test style.

## Rules

- Code that runs SQL MUST be tested against a real PostgreSQL through the project's helper, one fresh database per test.
- Database tests MUST run in plain `go test ./...`, with no build tag, and MUST fail (not skip) in CI when the database is unavailable.
- Tests that share a database MUST NOT call `t.Parallel()`; tests that each call `dbtest.Open(t)` may.
- Service-layer tests SHOULD use hand-written fakes of small, consumer-declared interfaces.
- Tests MUST use the standard library `testing` package only.
- NEVER test against production databases.

→ See `go-testing` skill for general test patterns, `t.Parallel()` and the race detector, and `gitlab-ci` for the CI job.
