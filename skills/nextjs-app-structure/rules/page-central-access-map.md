---
title: Access is declared once, centrally
impact: MEDIUM
tags: pages
check: test, scan (candidates), review
---

## Access is declared once, centrally

**Impact: MEDIUM**

A new page adds its entry to the one route → permission map (checked by the shell or `proxy.ts`), and its backend route declares the same permission. Pages don't check roles themselves, and hiding a menu item is not access control.

**Incorrect:**

```tsx
if (user.role !== "admin") return <Forbidden />;
```

**Correct:**

```ts
// the route → permission map
{ path: "/admin/items", permission: "items.read" },
```

**How to check:** `templates/access-map.test.ts` lists the routes of `app/**/page.tsx`, imports the route → permission map (set its module and export at the top) and fails on a route with no entry; a `PUBLIC` list with reasons covers the open pages and fails when stale. `scripts/scan.sh` lists pages that check roles themselves (`.role ===`, `roles.includes(`). Whether the backend route declares the same permission, and whether the shell or `proxy.ts` enforces the map, stay review.
