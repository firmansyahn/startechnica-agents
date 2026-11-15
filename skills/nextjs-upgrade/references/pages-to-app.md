# Pages Router to App Router

Two tracks use this file:

- **Own stack:** upgrade mode, when the user asks for the router move too. The app keeps its libraries; only the router changes, and so do the libraries the router forces ([app-router-libraries.md](app-router-libraries.md)).
- **Team stack:** migrate mode, phase 4. The same steps, but each moved page takes the team's shape (`nextjs-app-structure`, `nextjs-data`, `nextjs-bff`).

Next's own guide is `node_modules/next/dist/docs/01-app/02-guides/migrating/app-router-migration.md`; read it for the installed version. Library-specific changes and the errors you will meet: [app-router-libraries.md](app-router-libraries.md).

## 0. Before the first route

- **The version upgrade is merged** (`migrate-after-upgrade` in migrate mode; in upgrade mode, the router move is its own merge request after the upgrade). The app router needs React 19 from Next 15 on.
- **Route list:** `bash <this skill>/scripts/routes.sh <app-root>` prints every route with the router that serves it (`pages`, `app`, or `both`, which is a conflict), so you can track progress. Save the first run in the merge request.
- **Classify each route:**
  - static content;
  - server data (`getServerSideProps`);
  - static data (`getStaticProps`, ISR);
  - client-only data;
  - forms and writes;
  - API (`pages/api`);
  - behind sign-in;
  - locale-prefixed.
- **Baseline per route,** on top of the upgrade's baseline: the status code, redirects, `Cache-Control` and other response headers, the title and meta tags, and a screenshot. Compare against it after each move (`router-route-by-route`).
- **Order:** the root layout first, then routes from simplest to hardest, section by section (all of `/customers`, then all of `/orders`). Users then move between routers only at section edges. `pages/api` comes last.

## 1. The root layout and providers

`app/layout.tsx` is the root layout of everything under `app/`. It replaces `_app` and `_document` there. `_app` and `_document` stay until the last Pages Router route has moved.

```tsx
// app/layout.tsx (Server Component)
import "./globals.css";               // global CSS may be imported in any layout
import { Providers } from "./providers";

export const metadata = { title: { default: "Example", template: "%s · Example" } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```tsx
// app/providers.tsx: every context provider that _app rendered
"use client";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider><DataProvider>{children}</DataProvider></ThemeProvider>;
}
```

- **What moves from `_document`:** `<Html lang>`, `<body>` classes, fonts (`next/font`), and `beforeInteractive` scripts (`next/script` in the root layout).
- **What moves from `_app`:**
  - global CSS;
  - providers, which go in the client `Providers` file, since a context can't be created in a Server Component;
  - analytics page-view tracking (see the routing hooks below);
  - a `getLayout` per page, which becomes a nested `layout.tsx`, with the interactive part in a client component.
- **`_app.getInitialProps`** becomes data fetched in the (async) root layout or the segment's layout.
- **Team stack:** the providers live in `src/providers/` (`QueryProvider`, theme, next-intl), as in `nextjs-new-app` (`assets/app/layout.tsx`).

Commit the layout with no route moved, and check that the app still builds and that `pages/` routes look as before. Styles imported in the layout don't reach `pages/` routes.

## 2. Moving one route

Pages Router file, before:

```tsx
// pages/customers/[id].tsx
import Head from "next/head";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ({ params, req }) => {
  const customer = await getCustomer(String(params!.id), req.cookies.session);
  if (!customer) return { notFound: true };
  return { props: { customer } };
};

export default function CustomerPage({ customer }: { customer: Customer }) {
  const router = useRouter();
  return (
    <>
      <Head><title>{customer.name}</title></Head>
      <CustomerCard customer={customer} onEdit={() => router.push(`/customers/${customer.id}/edit`)} />
    </>
  );
}
```

**Own stack**: the page component moves into a client component unchanged, and the server page does what `getServerSideProps` did:

```tsx
// app/customers/[id]/page.tsx (Server Component)
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { CustomerPage } from "./CustomerPage";

async function load(id: string) {
  return getCustomer(id, (await cookies()).get("session")?.value);
}

export async function generateMetadata({ params }: PageProps<"/customers/[id]">) {
  const customer = await load((await params).id);
  return { title: customer?.name };
}

export default async function Page({ params }: PageProps<"/customers/[id]">) {
  const customer = await load((await params).id);
  if (!customer) notFound();
  return <CustomerPage customer={customer} />;   // only serializable props cross (router-serializable-props)
}
```

```tsx
// app/customers/[id]/CustomerPage.tsx
"use client";
import { useRouter } from "next/navigation";

export function CustomerPage({ customer }: { customer: Customer }) {
  const router = useRouter();
  return <CustomerCard customer={customer} onEdit={() => router.push(`/customers/${customer.id}/edit`)} />;
}
```

When the page and `generateMetadata` both need the data, wrap the loader in React `cache()`, or use a `fetch` both share, so it runs once per request.

**Team stack**: the server page stays thin (`page-thin-server-page`). The client component reads through TanStack Query: `useQuery(customers.get(id))`, optionally prefetched in the page with `HydrationBoundary` (`nextjs-data` references/queries.md). The session cookie goes through the BFF (`nextjs-bff`), not a token in the page. The title comes from the messages file (`i18n-metadata-translated`).

In the same commit:

- **Delete the `pages/` file:** one router per path (`router-one-router-per-path`).
- **Move or add its page test,** and compare it with the route's baseline.
- Run `scripts/routes.sh` again: the route now shows `app`.

## 3. What maps to what

### Data fetching

| Pages Router | App Router |
|---|---|
| `getServerSideProps` | An async Server Component (page or layout) that reads the data. `fetch` is uncached by default since 15. A direct database or SDK call works too. |
| `context.req.cookies`, `context.req.headers` | `await cookies()`, `await headers()` from `next/headers` (read-only in a page; set cookies in a Server Action or route handler) |
| `context.params`, `context.query` | `await params`, `await searchParams` props (`PageProps<"/route">` after `next typegen`) |
| `return { notFound: true }` | `notFound()` from `next/navigation`, with `not-found.tsx` for the UI |
| `return { redirect: { destination, permanent } }` | `redirect(destination)` (307) or `permanentRedirect(destination)` (308). Same codes as before; check them against the baseline. |
| `context.res.setHeader("Cache-Control", ...)` | No page-level equivalent. Use segment config (`export const revalidate`, `export const dynamic`), `next.config` `headers()`, or a route handler. |
| `getStaticProps` | An async Server Component with `fetch(url, { cache: "force-cache" })`, or the page's `export const revalidate` |
| `getStaticProps` + `revalidate: n` | `export const revalidate = n` on the segment, or `fetch(url, { next: { revalidate: n } })` |
| `getStaticPaths` | `generateStaticParams()` (returns an array of params objects) |
| `fallback: false / true / "blocking"` | `export const dynamicParams = false` (404 outside the list), or `true` (the default, rendered on demand) |
| `getInitialProps` on a page | An async Server Component |
| Client-side fetching (`useEffect`, SWR, React Query) | Unchanged, inside a client component. Team stack: TanStack Query (`nextjs-data`). |

### Routing hooks

`next/router` doesn't work under `app/` ("NextRouter was not mounted"). Use `next/navigation`, in client components only:

| `next/router` | `next/navigation` |
|---|---|
| `router.pathname`, `router.asPath`, `router.route` | `usePathname()` (the path, no query); `useSelectedLayoutSegments()` |
| `router.query` | `useParams()` for path segments, `useSearchParams()` for the query string |
| `router.push(url, as, { shallow: true })` | `router.push(url)` (no `as`). For shallow URL updates, `window.history.pushState` / `replaceState`, which stays in sync with `useSearchParams` |
| `await router.push(...)` | `push` and `replace` return nothing: wrap them in `startTransition` and read `isPending` for a pending state |
| `router.events` (`routeChangeStart`, ...) | No events. Track page views in an effect on `usePathname()` and `useSearchParams()`. |
| `router.isReady`, `router.isFallback` | Not needed: no fallback, and `useSearchParams` renders on the client |
| `router.locale`, `locales`, `defaultLocale` | Removed: the locale comes from a `[locale]` segment or the i18n library |
| `router.basePath` | Not exposed: `next/link` and `push` add it themselves |

A component used by both routers while they coexist imports `useRouter` from `next/compat/router`, which returns `null` under `app/`, or takes the values it needs as props. Remove `next/compat/router` at the end.

### Head and metadata

| Pages Router | App Router |
|---|---|
| `next/head` with `<title>`, `<meta>` | `export const metadata` or `generateMetadata()` in a page or layout (Server Component only) |
| A `<Head>` in `_app` for defaults | The root layout's `metadata` with a `title.template` |
| `<meta name="viewport">`, `theme-color` | `export const viewport` |
| Favicons and OG images in `<Head>` | Files: `app/icon.png`, `app/apple-icon.png`, `opengraph-image.tsx` |
| `<Html lang>` in `_document` | `<html lang>` in the root layout (or the `[locale]` layout) |

### API routes

`pages/api` keeps working unchanged until the end. Move it last, endpoint by endpoint:

```ts
// pages/api/customers/[id].ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  res.status(200).json(await getCustomer(String(req.query.id)));
}
```

```ts
// app/api/customers/[id]/route.ts
export async function GET(_request: Request, { params }: RouteContext<"/api/customers/[id]">) {
  return Response.json(await getCustomer((await params).id));   // other methods answer 405 automatically
}
```

- `req.query` → `params` plus `request.nextUrl.searchParams` (with `NextRequest`). `req.body` → `await request.json()` or `await request.formData()`.
- `export const config = { api: { bodyParser: false } }` → not needed: read the raw body with `await request.text()` or `request.arrayBuffer()`, for example to verify a webhook signature.
- `res.setHeader` and `res.status` → a `Response` / `NextResponse` with `headers` and `status`; cookies through `(await cookies()).set()` or `response.cookies.set()`.
- **Team stack:** browser reads go through the BFF reads proxy, writes become Server Actions (`nextjs-data`), and only webhooks, files and probes stay route handlers.

### Errors and status pages

| Pages Router | App Router |
|---|---|
| `pages/404.tsx` | `app/not-found.tsx` (and per segment) |
| `pages/500.tsx`, `pages/_error.tsx` | `error.tsx` per segment (a client component with `error` and `reset`) and `app/global-error.tsx` for the root layout |
| Error reporting in `_error.getInitialProps` | `instrumentation.ts` `onRequestError` and the error boundaries (team: `nextjs-logging`) |

### Locales

The `next.config` `i18n` block applies to `pages/` only; App Router routes ignore it. Keep the block until the last Pages Router route has moved. The App Router gets its locale from a `[locale]` segment, with a redirect in `proxy.ts`, or from a cookie, through the i18n library. If the library has no App Router support, that is a forced library change ([app-router-libraries.md](app-router-libraries.md)). The URLs (`/en/customers`, `/de/customers`) must match the baseline.

### Styles and config

- Global CSS can be imported in any layout. CSS Modules and Sass are unchanged. Tailwind v3 needs `./app/**/*.{ts,tsx}` in `content` (v4 finds files itself).
- CSS-in-JS needs a style registry, and its styled components must be client components ([app-router-libraries.md](app-router-libraries.md)).
- `export const config = { runtime: "edge" }` in a page → `export const runtime = "edge"` in the segment. `pageExtensions` applies to `app/` too (`page.mdx`).

## 4. While both routers run

- **Navigation between routers is a full page load.** `next/link` doesn't prefetch across them, and client state (stores, caches) starts empty on the other side. Moving whole sections keeps this at the edges.
- **Middleware/proxy runs for both.** Check its matcher against the new paths (route groups don't change URLs).
- **The providers exist twice** (`_app` and the root layout): a provider change goes in both until `_app` is deleted.
- **Shared components:** no `next/router` or `next/head`. Use `next/compat/router` or props. They become client components when they use state or effects (`router-client-boundary`).

## 5. Finishing

When `scripts/routes.sh` shows no `pages` route:

1. Delete `pages/_app`, `_document`, `_error`, `404`, `500` and the empty `pages/` folder.
2. Remove the `next.config` `i18n` block, `next/compat/router` imports, and libraries that only the Pages Router needed (each named in the report).
3. Run the scan (`router-no-pages-apis-in-app` and the rest) and compare every route with its baseline: status codes, redirects, headers, metadata, screenshots, back and forward, scroll position, query-string state.

## 6. Checking a moved route

- [ ] Same status code, redirect target and code, and important response headers as the baseline
- [ ] Same title, description and OG tags (view source, not just the tab)
- [ ] Screenshot matches; no hydration warning in the console
- [ ] Client navigation inside the section works; links to unmoved routes do a full load and land correctly
- [ ] Back and forward, scroll restoration, query-string filters and the locale prefix behave as before
- [ ] The route's page test passes; the `pages/` file is gone; `routes.sh` shows `app`
