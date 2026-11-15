---
title: Only the data layer and the config reader touch process.env
impact: HIGH
tags: data
check: eslint, review
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

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags `process.env.X` (other than `NODE_ENV`, which Next inlines) and `const { X } = process.env` in pages, components, hooks and providers; route handlers are outside. Left to review: which modules in `src/` read the environment (the config reader and the data layer only).
