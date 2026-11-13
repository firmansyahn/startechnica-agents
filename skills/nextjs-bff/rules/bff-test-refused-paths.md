---
title: Every refused path spelling answers 404 without a backend call
impact: MEDIUM
tags: testing
check: review
---

## Every refused path spelling answers 404 without a backend call

**Impact: MEDIUM**

Table-test `..`, `%2e%2e`, `%2E%2e`, `%2f`, `%5c`, `\`, `%252e` (double encoding), an empty inner segment and an unknown namespace. Each answers 404 and the backend fake records no call.

**Correct:**

```ts
it.each(["../users", "%2e%2e/users", "users%2f..%2fadmin", "users\\x", "%252e%252e/x", "unknown/x"])("refuses %s", async (p) => {
  const res = await GET(req(`/admin/api/${p}`));
  expect(res.status).toBe(404);
  expect(backend.calls).toHaveLength(0);
});
```
