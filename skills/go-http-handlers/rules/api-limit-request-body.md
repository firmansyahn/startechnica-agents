---
title: Limit request bodies before reading them
impact: HIGH
tags: http-server, dos, request-body
check: scan (candidates)
---

## Limit request bodies before reading them

**Impact: HIGH** (one request with a multi-gigabyte body fills memory: `io.ReadAll` and `json.Decode` read until EOF)

Wrap `r.Body` in `http.MaxBytesReader` before decoding or reading it, with a limit that fits the route (1 MiB for JSON, a larger explicit one for uploads), and answer 413 when it trips. A project may do this once in middleware; then routes that need more raise it explicitly.

**Incorrect:**

```go
var in CreateCustomerInput
if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
	writeError(w, http.StatusBadRequest, "invalid JSON")
	return
}
```

**Correct:**

```go
r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
var in CreateCustomerInput
if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
	if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
		writeError(w, http.StatusRequestEntityTooLarge, "request body too large")
		return
	}
	writeError(w, http.StatusBadRequest, "invalid JSON")
	return
}
```

**How to check:** `scripts/scan.sh` flags files that read `r.Body` (`json.NewDecoder(r.Body)`, `io.ReadAll(r.Body)`, `ParseForm`, `ParseMultipartForm`) and never mention `MaxBytesReader`. If the router applies a limit in middleware, confirm the route is behind it and drop the finding.
