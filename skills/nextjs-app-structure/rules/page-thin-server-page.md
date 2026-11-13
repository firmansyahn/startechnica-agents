---
title: page.tsx is a thin server component
impact: MEDIUM
tags: pages
check: review
---

## page.tsx is a thin server component

**Impact: MEDIUM**

`page.tsx` reads `params`/`searchParams`, sets metadata from translations, and renders the client component. State, queries and handlers live in the client component; a `"use client"` `page.tsx` loses `generateMetadata` and server-side checks.

**Incorrect:**

```tsx
"use client";
export default function Page() {
  const list = useQuery(items.list(scope, params));
  /* the whole page */
}
```

**Correct:**

```tsx
// page.tsx
export async function generateMetadata() {
  const t = await getTranslations("admin.items.meta");
  return { title: t("title"), description: t("description") };
}
export default function Page() { return <ItemsClient />; }
```
