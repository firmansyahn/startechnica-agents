---
title: A 5xx message is generic; the details go to the log with the request id
impact: HIGH
tags: errors, 5xx, logging, security
check: review
---

## A 5xx message is generic; the details go to the log with the request id

**Impact: HIGH** (error text in a reply leaks SQL, internal names and stack details)

**Incorrect:**

```go
httpx.Fail(w, 500, err.Error(), nil)   // "pq: duplicate key value violates unique constraint ..."
```

**Correct:**

```go
log.ErrorContext(ctx, "patch item", slog.Any("error", err))   // request id from the context
httpx.Fail(w, 500, "Something went wrong", nil)              // X-Request-Id is on the reply
```

**How to check:** `grep -rn 'Fail(w, 5[0-9][0-9], err.Error()' --include=*.go`; in review, any 5xx reply built from an error's text.
