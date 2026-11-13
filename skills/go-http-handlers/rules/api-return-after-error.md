---
title: Return right after writing an error response
impact: HIGH
tags: http-server, handlers, control-flow
check: scan
---

## Return right after writing an error response

**Impact: HIGH** (the handler goes on to run the operation it just refused, writes a second body after the error, and logs "superfluous WriteHeader")

`http.Error` and the project's `writeError` helpers write a response; they don't stop the handler. Every call is followed by `return`.

**Incorrect:**

```go
if !policy.Can(caller, "customers.write") {
	http.Error(w, "forbidden", http.StatusForbidden)
}
s.deleteCustomer(ctx, id) // still runs
```

**Correct:**

```go
if !policy.Can(caller, "customers.write") {
	http.Error(w, "forbidden", http.StatusForbidden)
	return
}
s.deleteCustomer(ctx, id)
```

**How to check:** `scripts/scan.sh` flags an `http.Error(` (or a `writeError(`/`WriteError(` helper) whose next non-blank line is neither `return` nor a closing brace. In tests, a handler test for each refusal asserts that the store was not called.
