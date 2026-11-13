---
title: Log the route template, never the query string
impact: MEDIUM
tags: logging
check: review
---

## Log the route template, never the query string

**Impact: MEDIUM**

Log `/items/:id` or the path without its query; the query may hold authorization codes, tokens, emails or search terms.

**Incorrect:**

```ts
log.debug({ url: req.url }, "backend call");
```

**Correct:**

```ts
log.debug({ "url.path": "/items/:id", "http.response.status_code": res.status }, "backend call");
```
