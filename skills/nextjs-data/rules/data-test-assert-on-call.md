---
title: Assert on the call made
impact: MEDIUM
tags: testing
check: review
---

## Assert on the call made

**Impact: MEDIUM**

Check the method, path, body and scope header the code sent, not that a function was called.

**Correct:**

```tsx
await user.click(screen.getByRole("button", { name: "Save" }));
expect(calls.find((c) => c.method === "PATCH")).toMatchObject({ path: "items/42", body: { name: "North" }, headers: { "tenant-id": "t1" } });
```
