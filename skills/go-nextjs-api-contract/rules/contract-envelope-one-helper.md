---
title: Every JSON reply uses the envelope, written by one helper
impact: HIGH
tags: envelope, go, handlers
check: review
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

**How to check:** `grep -rn 'json.NewEncoder(w)' --include=*.go` outside the envelope helper; the reply check fails on a bare body.
