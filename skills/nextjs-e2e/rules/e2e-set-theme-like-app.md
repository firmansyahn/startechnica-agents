---
title: Set the theme the way the app stores it
impact: LOW
tags: visual
check: review
---

## Set the theme the way the app stores it

**Impact: LOW**

`colorScheme: "dark"` only changes `prefers-color-scheme`. An app that stores the choice (next-themes `localStorage`, an appearance cookie, the session) needs that set before `goto`, or the "dark" screenshot is light.

**Incorrect:**

```ts
test.use({ colorScheme: "dark" });   // the app reads its appearance cookie; this changes nothing
```

**Correct:**

```ts
await page.context().addCookies([{ name: "appearance", value: "mode=dark", url: baseURL }]);
await page.goto("/app/items");
```
