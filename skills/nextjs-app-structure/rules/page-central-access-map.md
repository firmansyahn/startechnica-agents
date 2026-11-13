---
title: Access is declared once, centrally
impact: MEDIUM
tags: pages
check: review
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
