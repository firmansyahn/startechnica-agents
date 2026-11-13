# Integration Testing

## Table of Contents

- [Docker Compose Fixture](#docker-compose-fixture)
- [SQL Schema Fixture](#sql-schema-fixture)
- [Test Data Fixture](#test-data-fixture)
- [One Fresh Database per Test](#one-fresh-database-per-test)
- [Using Fixtures in Tests](#using-fixtures-in-tests)
- [Test Helper with Embedded Fixtures](#test-helper-with-embedded-fixtures)

Database code is tested against a real PostgreSQL, one fresh database per test, in plain `go test ./...` (no `//go:build integration` gate, no `go-sqlmock`). In CI the server comes from the job (a DSN in an env var); locally from a throwaway server such as the Compose file below. testcontainers is fine where a project already uses it to start that server.

## Docker Compose Fixture

Create `internal/myfeature/testdata/docker-compose.yml` for a throwaway local server (start it with `docker compose -f testdata/docker-compose.yml up -d --wait`, which waits for the health checks):

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: testdb
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
```

## SQL Schema Fixture

Create `internal/myfeature/testdata/schema.sql` for database initialization:

```sql
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Test Data Fixture

Create `internal/myfeature/testdata/testdata.sql`:

```sql
INSERT INTO users (name, email) VALUES
    ('Alice Johnson', 'alice@example.com'),
    ('Bob Smith', 'bob@example.com'),
    ('Charlie Brown', 'charlie@example.com');

INSERT INTO orders (user_id, amount, status) VALUES
    (1, 100.00, 'completed'),
    (1, 50.00, 'pending'),
    (2, 200.00, 'completed');
```

## One Fresh Database per Test

A helper package (`database/dbtest`) creates a database for each test, applies the schema, and drops it when the test ends. Each test owns its database, so tests can call `t.Parallel()` and need no truncation between them:

```go
package dbtest

import (
    "context"
    "database/sql"
    "fmt"
    "math/rand/v2"
    "net/url"
    "os"
    "testing"

    _ "github.com/jackc/pgx/v5/stdlib"
)

// Open returns a fresh database with the schema applied, dropped when t ends.
func Open(t *testing.T) *sql.DB {
    t.Helper()

    dsn := os.Getenv("TEST_DATABASE_URL") // CI: the job's PostgreSQL; locally: the Compose server
    if dsn == "" {
        dsn = "postgres://test:test@localhost:5433/testdb?sslmode=disable"
    }
    admin, err := sql.Open("pgx", dsn)
    if err != nil {
        t.Fatalf("dbtest: connect: %v", err)
    }
    t.Cleanup(func() { admin.Close() })

    name := fmt.Sprintf("test_%x", rand.Uint64())
    if _, err := admin.ExecContext(t.Context(), "CREATE DATABASE "+name); err != nil {
        t.Fatalf("dbtest: create database: %v", err)
    }

    u, err := url.Parse(dsn)
    if err != nil {
        t.Fatalf("dbtest: parse DSN: %v", err)
    }
    u.Path = "/" + name
    db, err := sql.Open("pgx", u.String())
    if err != nil {
        t.Fatalf("dbtest: connect to %s: %v", name, err)
    }
    t.Cleanup(func() {
        db.Close()
        // t.Context() is already cancelled when cleanups run.
        if _, err := admin.ExecContext(context.Background(), "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)"); err != nil {
            t.Logf("dbtest: drop %s: %v", name, err)
        }
    })

    if err := applySchema(t.Context(), db); err != nil { // the project's migrations, or SetupDB below
        t.Fatalf("dbtest: schema: %v", err)
    }
    return db
}
```

When the schema grows and migrating per test gets slow, migrate one template database once and create each test's database from it (`CREATE DATABASE <name> TEMPLATE <template>`).

## Using Fixtures in Tests

```go
package database_test

import (
    "database/sql"
    "math"
    "os"
    "testing"

    "example.com/app/database/dbtest"
)

func loadTestData(t *testing.T, db *sql.DB) {
    t.Helper()
    data, err := os.ReadFile("testdata/testdata.sql")
    if err != nil {
        t.Fatalf("read test data: %v", err)
    }
    if _, err := db.ExecContext(t.Context(), string(data)); err != nil {
        t.Fatalf("load test data: %v", err)
    }
}

func TestUserCount(t *testing.T) {
    t.Parallel()
    db := dbtest.Open(t)
    loadTestData(t, db)

    var count int
    if err := db.QueryRowContext(t.Context(), "SELECT COUNT(*) FROM users").Scan(&count); err != nil {
        t.Fatalf("count users: %v", err)
    }
    if count != 3 {
        t.Errorf("users = %d, want 3", count)
    }
}

func TestOrderSum(t *testing.T) {
    t.Parallel()
    db := dbtest.Open(t)
    loadTestData(t, db)

    var sum float64
    if err := db.QueryRowContext(t.Context(), "SELECT SUM(amount) FROM orders").Scan(&sum); err != nil {
        t.Fatalf("sum orders: %v", err)
    }
    if math.Abs(sum-350.0) > 0.01 {
        t.Errorf("order sum = %.2f, want 350.00", sum)
    }
}
```

## Test Helper with Embedded Fixtures

```go
package myfeature

import (
    "database/sql"
    "embed"
)

//go:embed testdata/schema.sql testdata/testdata.sql
var fixtures embed.FS

func SetupDB(db *sql.DB) error {
    schema, err := fixtures.ReadFile("testdata/schema.sql")
    if err != nil {
        return err
    }
    if _, err := db.Exec(string(schema)); err != nil {
        return err
    }

    data, err := fixtures.ReadFile("testdata/testdata.sql")
    if err != nil {
        return err
    }
    if _, err := db.Exec(string(data)); err != nil {
        return err
    }
    return nil
}
```
