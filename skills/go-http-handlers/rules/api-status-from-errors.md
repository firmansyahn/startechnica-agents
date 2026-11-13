---
title: Map errors to statuses in one place and never send internal errors
impact: MEDIUM
tags: http-server, errors, status-codes, information-disclosure
check: scan (candidates)
---

## Map errors to statuses in one place and never send internal errors

**Impact: MEDIUM** (raw error text leaks SQL, hostnames and file paths to clients; ad-hoc status choices make the same failure a 400 in one route and a 500 in another)

Domain code returns sentinels and typed errors (`ErrNotFound`, `ErrConflict`, `*ValidationError`); one function at the surface maps them to statuses (404, 409, 422) and a client-safe message. Anything unmapped is a 500 with a generic message and the request id; the full error is logged there, once. Never send `err.Error()` to the client, and never answer 200 with an error in the body.

**Incorrect:**

```go
if err != nil {
	http.Error(w, err.Error(), http.StatusBadRequest) // "get customer 42: ERROR: relation \"customers\" ... (SQLSTATE 42P01)"
	return
}
```

**Correct:**

```go
func writeErr(w http.ResponseWriter, r *http.Request, log *slog.Logger, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, domain.ErrConflict):
		writeError(w, http.StatusConflict, "already exists")
	default:
		log.ErrorContext(r.Context(), "request failed", "err", err)
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}
```

**How to check:** `scripts/scan.sh` flags `err.Error()` passed to `http.Error`, `Write`, `WriteString`, `Encode` or a JSON field. In review, look for status codes chosen inline in handlers instead of through the shared mapping.
