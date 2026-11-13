---
title: Only the data layer and the config reader touch process.env
impact: HIGH
tags: data
check: review
---

## Only the data layer and the config reader touch process.env

**Impact: HIGH**

Components, pages and client code don't read `process.env`. One config module reads server variables per request; the data layer reads its own secrets. That keeps secrets out of render paths and makes them easy to audit.

**Incorrect:**

```tsx
export default async function Page() {
  const res = await fetch(`${process.env.BACKEND_URL}/items`, { headers: { "x-api-key": process.env.API_KEY! } });
}
```

**Correct:**

```tsx
export default async function Page() {
  const items = await listItemsDTO();        // src/data or src/api: config and key read there
}
```
