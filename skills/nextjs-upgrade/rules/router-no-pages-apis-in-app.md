---
title: Use no Pages Router API under app/
impact: HIGH
tags: router, app-router
check: scan
---

## Use no Pages Router API under app/

**Impact: HIGH** (next/router throws "NextRouter was not mounted", next/head renders nothing, and getServerSideProps is rejected under app/)

Under `app/`:

- `next/router` becomes `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`, `useParams`).
- `next/head` becomes `metadata`/`generateMetadata`.
- `getServerSideProps`, `getStaticProps`, `getStaticPaths` and `getInitialProps` become async Server Components and `generateStaticParams`.
- `getLayout` becomes a nested `layout.tsx`.
- `NextApiRequest` handlers become route handlers.

A component shared by both routers while they coexist imports `next/compat/router`, or takes the values as props.

**Incorrect:**

```tsx
"use client";
import { useRouter } from "next/router";
export function CustomerTabs() {
  const { query, push } = useRouter();
  return <Tabs value={String(query.tab)} onChange={(tab) => push({ query: { ...query, tab } })} />;
}
```

**Correct:**

```tsx
"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
export function CustomerTabs() {
  const router = useRouter(); const pathname = usePathname(); const params = useSearchParams();
  const select = (tab: string) => { const q = new URLSearchParams(params); q.set("tab", tab); router.push(`${pathname}?${q}`); };
  return <Tabs value={params.get("tab") ?? "details"} onChange={select} />;
}
```

**How to check:** `scripts/scan.sh` flags `next/router` and `next/head` imports, Pages Router data functions, `getLayout` and `NextApiRequest` under `app/`, and `next/router` in shared `components/`, `hooks/` and `lib/` folders once `app/` exists.
