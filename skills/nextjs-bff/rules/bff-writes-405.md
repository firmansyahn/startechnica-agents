---
title: Writes answer 405, except allow-listed uploads
impact: CRITICAL
tags: proxy
check: scan, test, review
---

## Writes answer 405, except allow-listed uploads

**Impact: CRITICAL**

The proxy forwards `GET` and `HEAD`. Other methods answer 405 with `Allow: GET, HEAD`, except `POST` to named upload paths, whose bodies are streamed (`duplex: "half"`). Writes belong to server actions, where Next's Origin check, zod validation and the `Result` contract apply.

**Incorrect:**

```ts
export const GET = handleApi;
export const POST = handleApi;
export const PATCH = handleApi;
export const DELETE = handleApi;
```

**Correct:**

```ts
export const GET = handleApi;
export const HEAD = handleApi;
export const POST = handleApi;   // handleApi answers 405 unless the path is on the upload allow-list
```

**How to check:** `scripts/scan.sh` reports a `PUT`, `PATCH` or `DELETE` export in the reads proxy's catch-all route (`app/**/api/[...path]/route.ts`); other route handlers, such as webhooks, are left alone. The proxy test `bff-test-writes-405` asks for covers what the exports can't show: `PATCH`, `PUT`, `DELETE` and a `POST` to a path off the upload allow-list answer 405 with `Allow: GET, HEAD`.
