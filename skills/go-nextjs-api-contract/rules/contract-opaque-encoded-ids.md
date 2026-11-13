---
title: Ids are opaque strings, encoded in paths
impact: HIGH
tags: ids, paths, security
check: review
---

## Ids are opaque strings, encoded in paths

**Impact: HIGH** (an unencoded id can point the call at another endpoint)

Ids are `type: string` on the wire even when stored as integers; clients never parse, order or compute them. A path segment is encoded by the client and checked by the server.

**Incorrect:**

```ts
read<Item>(`items/${id}`);              // an id of "../admins" reaches another endpoint
```

**Correct:**

```ts
read<Item>(`items/${encodeURIComponent(id)}`);
```

```go
id := r.PathValue("id")
if !validID(id) {
	httpx.Fail(w, http.StatusNotFound, "Item not found", nil)
	return
}
```

**How to check:** in review, ids interpolated into request paths without `encodeURIComponent`, and handlers using `r.PathValue` without a validity check.
