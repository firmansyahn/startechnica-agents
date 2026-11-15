---
title: A 5xx message is generic; the details go to the log with the request id
impact: HIGH
tags: errors, 5xx, logging, security
check: scan, review
---

## A 5xx message is generic; the details go to the log with the request id

**Impact: HIGH** (error text in a reply leaks SQL, internal names and stack details)

**Incorrect:**

```go
httpx.Fail(w, 500, err.Error(), nil)   // "pq: duplicate key value violates unique constraint ..."
```

**Correct:**

```go
log.Error("patch item", zap.String("http.request.id", requestID(ctx)), zap.Error(err)) // the id the middleware stored
httpx.Fail(w, 500, "Something went wrong", nil) // X-Request-Id is on the reply
```

**How to check:** `scripts/scan.sh` lists `Fail(w, 5xx, ...)` calls whose message is built with `.Error()`, `fmt.Sprintf` or `fmt.Errorf`, and `http.Error(w, err.Error(), 5xx)`. It misses a message passed through a variable or a call split over lines. A handler test with a failing store that asserts the 500's `message` is the generic one covers those; in review, 5xx paths without such a test.
