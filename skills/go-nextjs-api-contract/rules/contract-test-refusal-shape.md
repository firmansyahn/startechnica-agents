---
title: Refusals are tested for their shape, not just their status
impact: MEDIUM
tags: tests, errors
check: test
---

## Refusals are tested for their shape, not just their status

**Impact: MEDIUM** (a status-only assertion passes while the error paths, headers or messages are wrong)

A 422 test asserts the `errors` paths; a guard 401 test asserts `WWW-Authenticate`; a 404 for another scope's record asserts it is a 404, not a 403; a 500 test asserts the generic message.

**Incorrect:**

```go
if rec.Code != 422 { t.Fatal(rec.Code) }
```

**Correct:**

```go
contract.Check(t, doc, "POST", "/items", rec)
if got := failure(t, rec).Errors["rules.2.value"]; len(got) == 0 {
	t.Fatalf("errors = %v, want rules.2.value", failure(t, rec).Errors)
}
```

**How to check:** in review, refusal tests that check only `rec.Code`.
