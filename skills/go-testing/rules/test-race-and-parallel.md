---
title: Run tests with -race; parallel tests share nothing
impact: MEDIUM
tags: tests, race-detector, parallel
check: test (CI)
---

## Run tests with -race; parallel tests share nothing

**Impact: MEDIUM** (data races pass ordinary tests and corrupt state in production; parallel tests that share a database or a global fail at random)

CI runs `go test -race ./...` (at least on the packages with goroutines). A test that calls `t.Parallel()` owns everything it touches: its own database or schema, its own server, no package globals, no `t.Setenv` (which panics with `t.Parallel()`). Since Go 1.22 the loop variable is per iteration, so `tt := tt` is no longer needed.

**Incorrect:**

```go
for _, tt := range tests {
	t.Run(tt.name, func(t *testing.T) {
		t.Parallel()
		sharedDB.Exec(ctx, `TRUNCATE customers`) // races with the other cases
		// ...
	})
}
```

**Correct:**

```go
for _, tt := range tests {
	t.Run(tt.name, func(t *testing.T) {
		t.Parallel()
		db := dbtest.Open(t) // one database per case
		// ...
	})
}
```

**How to check:** the CI job runs with `-race`; in review, check what each `t.Parallel()` test shares.
