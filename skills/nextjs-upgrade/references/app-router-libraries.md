# Libraries and errors in the App Router

What the router move forces on common libraries, and the errors you will meet while moving routes. Always read the library's own App Router guide for the version installed: the table says what to look for, not every detail.

## Libraries

In upgrade mode the library stays, and only its setup changes. When a library has no App Router support, replacing it is a forced change: ask the user, then name it in the report (`upgrade-keep-their-stack`). In migrate mode the "Team stack" column is the target.

| Library | What changes in the App Router | Team stack |
|---|---|---|
| styled-components | `compiler: { styledComponents: true }` in `next.config`; a client style registry using `useServerInsertedHTML` and `ServerStyleSheet` around the root layout's children; styled components only in client components | Tailwind v4 (`nextjs-ui`) |
| emotion, MUI | MUI: `AppRouterCacheProvider` from `@mui/material-nextjs` in the root layout; emotion's `styled` and `css` only in client components | Tailwind v4, shadcn on Base UI |
| Chakra UI | Its provider in a client `Providers` file; check the version's Next.js App Router guide | Tailwind v4, shadcn on Base UI |
| SWR | `SWRConfig` in the client `Providers`; hooks only in client components; server data handed in through `fallback` | TanStack Query (`nextjs-data`) |
| TanStack / React Query | `QueryClientProvider` in a client provider, the client created once per browser session (`useState`); server prefetch with `HydrationBoundary` | Same, with the services registry (`nextjs-data`) |
| Redux, Redux Toolkit | A per-request store: a client `StoreProvider` that creates the store in `useRef`, never a module-level store shared across requests on the server | Zustand for client state, TanStack Query for server state (`nextjs-data`) |
| Zustand | A store per request through a context provider when it is used during server rendering | `nextjs-data` (per-request stores) |
| next-auth v4 | `app/api/auth/[...nextauth]/route.ts` exporting the handler as `GET` and `POST`; `getServerSession(authOptions)` in Server Components and route handlers; `SessionProvider` in the client `Providers` | The BFF and `oauth-client` |
| Auth.js v5 | `auth()` in Server Components, `handlers` in the route handler, the middleware or proxy export | The BFF and `oauth-client` |
| next-i18next | No App Router support. Move to an App Router setup of i18next (react-i18next) or another library: a forced change. | next-intl |
| next-intl, next-translate | Follow the library's App Router setup (`[locale]` segment or cookie, request config, provider) | next-intl (`nextjs-app-structure`, Strings) |
| next-seo | Built on `next/head`: replace with `metadata` / `generateMetadata` (a forced change; JSON-LD becomes a `<script type="application/ld+json">` in the page) | `metadata`, translated |
| next-sitemap | Still works as a post-build step; or `app/sitemap.ts` and `app/robots.ts` | `app/sitemap.ts` |
| Analytics (GA, GTM, others) | `next/script` (or `@next/third-parties`) in the root layout; page views from an effect on `usePathname()` and `useSearchParams()` instead of `router.events` | Same |
| Progress bars on `router.events` (nprogress) | No router events: a library built for the App Router, or start on link click and stop on a pathname change | Same |
| `@sentry/nextjs` | The SDK's App Router setup: `instrumentation.ts`, `global-error.tsx` reporting, its `next.config` wrapper | `nextjs-logging` |
| Apollo Client | Apollo's Next.js App Router integration package (client and RSC setup) | TanStack Query through the BFF |
| Formik, react-hook-form | Unchanged, in client components | react-hook-form + zod (`nextjs-forms`) |
| A component library with no `"use client"` | Re-export what you use from a file starting with `"use client"` | shadcn on Base UI |

## Errors while moving routes

| The error says | Cause | Fix |
|---|---|---|
| `You're importing a component that needs useState` (or `useEffect`, `createContext`) | A hook or a context in a Server Component | Put `"use client"` on the file that uses it, as low in the tree as possible (`router-client-boundary`) |
| `NextRouter was not mounted` | `next/router` under `app/` | `next/navigation`, or `next/compat/router` in shared components (`router-no-pages-apis-in-app`) |
| `Conflicting app and page file was found` | One path in both `pages/` and `app/` | Delete the `pages/` file in the commit that adds the `app/` route (`router-one-router-per-path`) |
| `useSearchParams() should be wrapped in a suspense boundary` | A client component reading search params on a statically rendered page | Wrap it in `<Suspense fallback={...}>`, or make the page dynamic |
| `Functions cannot be passed directly to Client Components` | A function, class instance or other non-serializable prop from a Server Component | Pass data only; move the callback into the client component, or make it a Server Action (`router-serializable-props`) |
| `You are attempting to export "metadata" from a component marked with "use client"` | `"use client"` on `page.tsx` or `layout.tsx` | Keep the page a Server Component; move the interactive part into a child client component |
| `ssr: false is not allowed with next/dynamic in Server Components` | `dynamic(() => import(...), { ssr: false })` in a server file | Move that `dynamic()` call into a client component |
| `Module not found: Can't resolve 'fs'` (or `net`, `tls`) in a client bundle | Server-only code imported from a client component | Keep it in server files; add `import "server-only"` to them so the mistake fails at build |
| `getServerSideProps is not supported in app/` (or `getStaticProps`) | A Pages Router data function left in the moved file | Move its body into the async Server Component (section 3 of [pages-to-app.md](pages-to-app.md)) |
| Hydration mismatch | Dates, `window`, random values or locale formatting differ between the server and the browser | Render client-only values after mount, format with a fixed locale and time zone |
| `cookies` / `headers` was called outside a request scope | Request APIs in `generateStaticParams`, at module level, or in a cached function | Read them inside the page, layout or route handler during the request |
