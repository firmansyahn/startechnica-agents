---
title: Writes answer 405, except allow-listed uploads
impact: CRITICAL
tags: proxy
check: review
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
