---
title: The frontend maps every reply through fromEnvelope
impact: MEDIUM
tags: typescript, envelope, result
check: review
---

## The frontend maps every reply through fromEnvelope

**Impact: MEDIUM** (each hand-rolled mapping reads the envelope differently and misses field errors)

Query functions, the BFF proxy and `apiAction` all turn a reply into a `Result` with the one `fromEnvelope`; no component reads `res.status` or `body.errors` itself.

**Incorrect:**

```ts
const body = await res.json();
if (body.status !== "success") toast.error(body.message);
```

**Correct:**

```ts
const result = fromEnvelope<Item>(res.status, await res.json().catch(() => null));
if (!result.ok) throw new ApiError(result.error);
```

**How to check:** in review, `res.status`, `body.status` or `body.errors` read outside `fromEnvelope` (the services transport, the BFF proxy, `apiAction`).
