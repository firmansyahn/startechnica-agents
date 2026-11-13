---
title: Return a Result from actions instead of throwing user-facing errors
impact: HIGH
tags: server-actions, errors
check: review
---

## Return a Result from actions instead of throwing user-facing errors

**Impact: HIGH** (in production the user sees a generic error instead of "name already taken")

Production builds replace thrown action errors with a digest. Actions return `{ ok: true, data }` or `{ ok: false, error: { status, message, fields? } }`; the client's `runAction` turns failures into an `ApiError` for `onError`. Throw only for programming errors. The returned data is what the UI renders, nothing more.

**Incorrect:**

```ts
export async function saveItem(input: unknown) {
  const res = await callBackend(...);
  if (!res.ok) throw new Error((await res.json()).message);
  return await db.item.findUnique(...);           // raw record to the browser
}
```

**Correct:**

```ts
export async function saveItem(input: unknown): Promise<Result<Item>> {
  ...
  return apiAction<Item>("PATCH", `items/${encodeURIComponent(id)}`, { body: changes, scope });
}
```

**How to check:** look for `throw` in `"use server"` files outside impossible-state guards, and for return values typed as database models.
