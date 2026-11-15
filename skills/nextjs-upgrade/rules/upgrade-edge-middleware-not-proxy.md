---
title: Keep edge middleware as middleware; proxy.ts runs on Node
impact: HIGH
tags: upgrade, next-16, middleware, proxy, runtime
check: scan
---

## Keep edge middleware as middleware; proxy.ts runs on Node

**Impact: HIGH** (a renamed edge middleware silently moves to the Node runtime, or fails, and edge-only code breaks)

Next 16 renames `middleware.ts` to `proxy.ts` (`middleware-to-proxy`), and `proxy` always runs on Node; its runtime can't be configured. Middleware that runs on the edge runtime stays `middleware.ts` (deprecated, still supported) until the user decides to move it to Node. A `proxy.ts` never sets `runtime`. Moving edge middleware to Node later is its own change: [references/edge-to-proxy.md](../references/edge-to-proxy.md).

**Incorrect:**

```ts
// proxy.ts, renamed from an edge middleware
export const config = { runtime: "edge", matcher: ["/customers/:path*"] };
export function proxy(request: NextRequest) { /* ... */ }
```

**Correct:**

```ts
// proxy.ts: Node runtime, no runtime key
export const config = { matcher: ["/customers/:path*"] };
export function proxy(request: NextRequest) { /* ... */ }
// or keep middleware.ts (edge) and note the deprecation in the report
```

**How to check:** `scripts/scan.sh` flags a `proxy.ts`/`proxy.js` that mentions `runtime`, and a `middleware.ts` next to a `proxy.ts`.
