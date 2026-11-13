---
title: Match errors with errors.Is/As, never == or strings
impact: HIGH
tags: errors, wrapping
check: scan, lint (errorlint)
---

## Match errors with errors.Is/As, never == or strings

**Impact: HIGH** (once anyone wraps the error, `==` and type assertions stop matching and the code takes the wrong branch: a 404 becomes a 500, a retry never happens)

Callers branch on a sentinel (`ErrNotFound`) with `errors.Is` or on a type (`*ValidationError`) with `errors.As`. Never compare `err.Error()` text, and never `==` or type-assert an error that may be wrapped. `io.EOF` straight from a `Read` is the one conventional `==`.

**Incorrect:**

```go
if err == pgx.ErrNoRows { // the store wraps it: fmt.Errorf("get customer: %w", err)
	return nil, ErrNotFound
}
if strings.Contains(err.Error(), "duplicate key") {
	return ErrConflict
}
```

**Correct:**

```go
if errors.Is(err, pgx.ErrNoRows) {
	return nil, ErrNotFound
}
if pgErr, ok := errors.AsType[*pgconn.PgError](err); ok && pgErr.Code == "23505" { // Go 1.26+; else errors.As
	return ErrConflict
}
```

**How to check:** `scripts/scan.sh` flags `err == ErrX`/`!= ErrX`, `.Error() ==` and `strings.Contains(err.Error(), ...)`; `errorlint` also catches type switches on errors.
