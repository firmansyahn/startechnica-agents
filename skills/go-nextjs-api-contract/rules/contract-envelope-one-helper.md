---
title: Every JSON reply uses the envelope, written by one helper
impact: HIGH
tags: envelope, go, handlers
check: scan (candidates), test, review
---

## Every JSON reply uses the envelope, written by one helper

**Impact: HIGH** (a bare row has no status or message, so the frontend's one mapping can't read it)

**Incorrect:**

```go
w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(item)                        // bare row: no status, no message
```

**Correct:**

```go
httpx.OK(w, item)                                      // {"status":"success","message":"","data":{...}}
httpx.Page(w, rows, total)                             // {"status":"success","message":"","data":[...],"total":132}
httpx.Fail(w, http.StatusConflict, msg, nil)           // {"status":"failed","message":"..."}
```

**How to check:** `scripts/scan.sh` lists `json.NewEncoder(w)` and `w.Write(...)` in files that take an `http.ResponseWriter`, outside `ENVELOPE_DIRS` (default `internal/httpx`; add the endpoints that answer outside the envelope: OAuth `/token`, health, metrics, downloads). The reply check (`contract.Check`, references/contract-tests.md) fails on a bare body wherever a handler test exists. In review: a reply written through another writer or helper.
