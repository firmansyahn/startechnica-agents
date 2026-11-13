---
title: Use the zod 4 API
impact: MEDIUM
tags: validation
check: review
---

## Use the zod 4 API

**Impact: MEDIUM**

String formats are top-level (`z.email()`, `z.url()`, `z.uuid()`, `z.iso.date()`), messages are `{ error: "..." }`, and errors flatten with `z.flattenError(err)`. The zod 3 forms (`z.string().email()`, `{ message }`, `err.flatten()`) are deprecated.

**Incorrect:**

```ts
email: z.string().email({ message: "Enter a valid email" }),
```

**Correct:**

```ts
email: z.email({ error: "Enter a valid email" }).optional().or(z.literal("")),
```
