---
title: Ids are opaque strings, encoded in paths
impact: HIGH
tags: ids, paths, security
check: scan (candidates), eslint (candidates), test, review
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

**How to check:** The OpenAPI document test (`assets/openapi_rules_test.go`) fails a path parameter or an `id`/`*_id` property that isn't `type: string`. On the frontend, the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) errors on a raw id in an `apiAction`/`read`/`readPage` path (rule `action-encode-path-segments`), and warns on an id-named value (`id`, `itemId`, `item_id`, `row.id`) interpolated raw into a template literal passed to any other call (translations and log calls excepted); a warning that isn't a request path is dismissed. On the backend, `scripts/scan.sh` lists files that take an id from `r.PathValue("...id")` with no `valid*(`, `uuid.Parse`, `strconv.Parse*` or `ParseID(` in them (candidates: the check may live in a helper). Left to review: paths built in a variable.
