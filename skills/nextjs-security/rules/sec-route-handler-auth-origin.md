---
title: Authenticate and authorize in every route handler, check the origin on writes, and never change state on GET
impact: CRITICAL
tags: route-handlers, auth, csrf
check: test, review
---

## Authenticate and authorize in every route handler, check the origin on writes, and never change state on GET

**Impact: CRITICAL** (anonymous or cross-site requests read or change other users' data)

`proxy.ts` gating is a convenience; each handler checks the session and the caller's right to the resource. Route handlers don't get the server-action origin check, so POST/PUT/PATCH/DELETE handlers require `Sec-Fetch-Site: same-origin` (or an `Origin` equal to the configured public origin). Links, prefetches and image tags send GETs cross-site, so a GET never writes (logout included).

**Incorrect:**

```ts
// app/logout/route.ts
export async function GET() { await signOut(); return redirect("/"); }

export async function GET(_req: Request, { params }: Ctx) {
  return Response.json(await getInvoice((await params).id));   // relies on proxy.ts
}
```

**Correct:**

```ts
export async function POST(req: Request) {
  if (!sameSite(req)) return new Response(null, { status: 403 });
  await signOut();
  return seeOther("/");
}

export async function GET(req: Request, { params }: Ctx) {
  const session = await requireSession(req);
  if (!session) return new Response(null, { status: 401 });
  const invoice = await getInvoiceDTO((await params).id);       // ownership checked in the data layer
  return invoice ? Response.json(invoice) : new Response(null, { status: 404 });
}
```

**How to check:** `assets/tests/route-handlers.test.ts` (copy it to `tests/`, set the session and origin helper names at its top) fails when an `app/**/route.*` never calls the session check, when a POST/PUT/PATCH/DELETE export doesn't call the origin check, or when a GET calls `signOut(`, sets or deletes a cookie, or writes through `db`/`prisma`; its `PUBLIC`, `NO_ORIGIN` and `GET_WRITE_ALLOWED` lists hold the exceptions with a reason and fail when stale. In review, check that the session check comes before data access and that the caller's right to the resource is checked (in the data layer); a check or write inside a helper the handler calls is invisible to the test. The BFF reads proxy has its own rules (`sec-proxy-*`).
