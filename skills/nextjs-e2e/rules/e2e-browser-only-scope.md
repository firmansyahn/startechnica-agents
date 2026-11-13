---
title: E2E covers what only a browser can show
impact: MEDIUM
tags: scope-and-ci
check: review
---

## E2E covers what only a browser can show

**Impact: MEDIUM**

Journeys across pages, `proxy.ts` gating and redirects, the session cookie, server actions end to end, headers and CSP, the theme's first paint, phone-width layout, accessibility. Validation messages, read-only states, query and action logic and translations are Vitest tests beside the code; repeating them in Playwright only makes the suite slow.

**Incorrect:**

```ts
// 12 Playwright tests, one per validation message of the item form
```

**Correct:**

```ts
// 1 Playwright journey: create an item, see it in the list, edit it, delete it
// validation messages in ItemForm.test.tsx
```
