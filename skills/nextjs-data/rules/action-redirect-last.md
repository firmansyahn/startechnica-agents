---
title: Call redirect() last, outside try/catch
impact: MEDIUM
tags: server-actions, redirect
check: review
---

## Call redirect() last, outside try/catch

**Impact: MEDIUM** (the redirect is swallowed, or code after it never runs)

`redirect()` throws a control-flow exception. Inside a `try` it is caught as an error; anything after it doesn't run. Do the work, update the cache (`updateTag`, `revalidatePath`), then redirect as the final statement.

**Incorrect:**

```ts
try {
  await save(input);
  redirect("/items");
  revalidatePath("/items");           // never runs
} catch (e) {
  return failure(e);                  // catches the redirect
}
```

**Correct:**

```ts
const result = await save(input);
if (!result.ok) return result;
revalidatePath("/items");
redirect("/items");
```

**How to check:** look for `redirect(` inside `try` blocks or followed by more statements.
