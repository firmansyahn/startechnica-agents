---
title: Test database code against a real database, one per test
impact: MEDIUM
tags: tests, database
check: scan (shared database: candidates), lint (depguard), review
---

## Test database code against a real database, one per test

**Impact: MEDIUM** (mocked SQL passes while the real query has a typo, a missing column, a wrong join or a constraint violation)

Code that runs SQL is tested against the real database engine, through a helper that gives each test its own fresh database or schema (`db := dbtest.Open(t)`, from a DSN in an env var in CI or a throwaway local server), migrated to the current schema. No `sqlmock` expectations on query text. Tests that share one database don't call `t.Parallel()`.

**Incorrect:**

```go
mock.ExpectQuery("SELECT id, name FROM customers").WillReturnRows(sqlmock.NewRows([]string{"id", "name"}).AddRow("1", "North"))
```

**Correct:**

```go
func TestListCustomers(t *testing.T) {
	db := dbtest.Open(t) // fresh, migrated, dropped on cleanup
	tenant := dbtest.Tenant(t, db)
	dbtest.Customer(t, db, tenant, "North")
	deleted := dbtest.Customer(t, db, tenant, "Old")
	mustSoftDelete(t, db, deleted)

	got, err := db.ListCustomers(t.Context(), tenant)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Name != "North" {
		t.Fatalf("ListCustomers = %+v, want only North", got)
	}
}
```

**How to check:** `scripts/scan.sh` lists every `go-sqlmock`/`pgxmock` import and `Expect*(` call in tests, and, as candidates, `t.Parallel()` in test files that use a package-level `*sql.DB` (or pool) declared in a test file of the same package. golangci-lint's `depguard`, with a rule denying the two mock modules in `$test` files ([go-code-style](../../go-code-style/SKILL.md)'s `assets/lint/.golangci.yml`), refuses the import. In review: new queries with no database test, and parallel tests sharing a database through a helper or a struct field.
