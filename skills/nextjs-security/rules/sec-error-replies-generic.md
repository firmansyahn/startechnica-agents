---
title: Error replies are generic
impact: HIGH
tags: data
check: review
---

## Error replies are generic

**Impact: HIGH**

Route handlers catch, log with the request id, and answer a status with a generic message. No stack, SQL, backend URL, file path or token in a reply; `error.tsx` shows the digest in production, not `error.message`.

**Incorrect:**

```ts
catch (e) { return Response.json({ error: String(e), stack: (e as Error).stack }, { status: 500 }); }
```

**Correct:**

```ts
catch (e) { log.error({ err: e, requestId }, "export failed"); return Response.json({ message: "Export failed" }, { status: 500 }); }
```
