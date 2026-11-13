---
title: Read configuration per call, never at module load
impact: HIGH
tags: config
check: review
---

## Read configuration per call, never at module load

**Impact: HIGH**

`src/api/config.ts` reads the backend URL, client id and secret, cookie settings and store URL from `process.env` inside functions called per request. A module-level `const BACKEND = process.env.BACKEND_URL` is evaluated at build time for prerendered code and freezes one environment into the image.

**Incorrect:**

```ts
export const BACKEND_URL = process.env.BACKEND_URL!;
```

**Correct:**

```ts
export function backendUrl(): string {
  const v = process.env.BACKEND_URL;
  if (!v) throw new Error("BACKEND_URL is not set");
  return v;
}
```
