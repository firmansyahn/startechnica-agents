---
title: onRequestError logs every uncaught server error
impact: MEDIUM
tags: errors
check: scan, review
---

## onRequestError logs every uncaught server error

**Impact: MEDIUM**

`instrumentation.ts` exports `onRequestError`, which logs the error (`err`), its `digest`, method, path without query, request id, `context.routePath` and `context.routeType` (render, route, action, proxy). It covers Server Components, route handlers, actions and the proxy. Async reporting inside it is awaited (`captureException`, then `flush`).

**Correct:**

```ts
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logger } = await import("@/libs/logger");
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  logger.error({ err, digest, "url.path": request.path.split("?")[0], "next.route": context.routePath, "next.route_type": context.routeType }, "request failed");
};
```

**How to check:** `scripts/scan.sh` flags an app with no `instrumentation.ts`/`.js` (at the root or in `src/`), one that exports no `onRequestError` (`export const`, `export function` or `export async function`), and an `onRequestError` file that never mentions `digest`. Review the other fields it logs (path without query, route, route type, request id) and that async reporting is awaited.
