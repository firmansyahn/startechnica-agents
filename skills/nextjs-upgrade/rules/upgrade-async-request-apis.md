---
title: Await params, searchParams, cookies, headers and draftMode
impact: HIGH
tags: upgrade, app-router, next-15, next-16
check: scan (candidates)
---

## Await params, searchParams, cookies, headers and draftMode

**Impact: HIGH** (synchronous access warns on 15 and is removed on 16: pages, layouts and route handlers break at request time)

Since 15, `cookies()`, `headers()`, `draftMode()`, and the `params` and `searchParams` props are promises, and 16 removes synchronous access. Metadata image functions and `sitemap` get their `params` and `id` as promises too. Run `next-async-request-api`, then fix what it marked. In a Client Component, unwrap the promise with React `use`.

**Incorrect:**

```tsx
export default function Page({ params }: { params: { id: string } }) {
  const locale = cookies().get("locale")?.value;
  return <Customer id={params.id} locale={locale} />;
}
```

**Correct:**

```tsx
export default async function Page({ params }: PageProps<"/customers/[id]">) {
  const { id } = await params;
  const locale = (await cookies()).get("locale")?.value;
  return <Customer id={id} locale={locale} />;
}
```

**How to check:** `scripts/scan.sh` flags `cookies().`, `headers().` and `draftMode().` member access, and `params`/`searchParams` typed as plain objects, under `app/`. Typecheck after `next typegen` catches the rest.
