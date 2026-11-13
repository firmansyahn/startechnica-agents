---
title: A valid submit sends one call with the expected body
impact: LOW
tags: testing
check: review
---

## A valid submit sends one call with the expected body

**Impact: LOW**

Assert on the recorded network call: method, path, scope header and body.

**Correct:**

```tsx
expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
expect(calls[0]).toMatchObject({ path: "items", body: { name: "North", enabled: true } });
```
