---
title: The HTTP status and the envelope's status agree
impact: HIGH
tags: envelope, status-codes
check: test
---

## The HTTP status and the envelope's status agree

**Impact: HIGH** (a 200 that says failed hides refusals from caches, proxies, logs and the frontend's `ok` check)

2xx ↔ `"success"`, 4xx/5xx ↔ `"failed"`. A `200` with `"status": "failed"` hides refusals from caches, proxies, logs and the frontend's `ok` check.

**Incorrect:**

```go
httpx.Write(w, http.StatusOK, httpx.Envelope{Status: "failed", Message: "Name already taken"})
```

**Correct:**

```go
httpx.Fail(w, http.StatusUnprocessableEntity, "Check the highlighted fields", httpx.FieldErrors{"name": {"Already taken"}})
```

**How to check:** the handler-test reply check rejects a 2xx with `"failed"` or a 4xx/5xx with `"success"`.
