---
title: Put "use client" on the components that need the browser, not on pages
impact: MEDIUM
tags: router, app-router, server-components
check: scan (candidates)
---

## Put "use client" on the components that need the browser, not on pages

**Impact: MEDIUM** (a hook in a Server Component fails the build; "use client" on a page loses metadata and ships the whole page as client code)

Files under `app/` are Server Components unless they start with `"use client"`. A file using state, effects, context, `next/navigation` hooks, event handlers or `dynamic(..., { ssr: false })` is a client component, and it starts with the directive. `page.tsx` and `layout.tsx` stay Server Components: they export `metadata` and render a client child, which keeps the boundary as low in the tree as it can go.

**Incorrect:**

```tsx
// app/customers/page.tsx
"use client";
export const metadata = { title: "Customers" };   // not allowed in a client file
export default function Page() { const [q, setQ] = useState(""); /* ... */ }
```

**Correct:**

```tsx
// app/customers/page.tsx (Server Component)
import { CustomersPage } from "./CustomersPage";
export const metadata = { title: "Customers" };
export default function Page() { return <CustomersPage />; }

// app/customers/CustomersPage.tsx
"use client";
export function CustomersPage() { const [q, setQ] = useState(""); /* ... */ }
```

**How to check:** `scripts/scan.sh` flags `metadata`, `viewport`, `generateMetadata` or `generateStaticParams` exported from a `"use client"` file, and hooks, event handlers or `ssr: false` in `app/` files without the directive. A file without it that only runs inside client components is fine: confirm each one.
