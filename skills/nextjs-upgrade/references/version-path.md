# The path from 12 to 16

Built from Next's upgrade guides and codemod list. After the target is installed, read each crossed major's guide from the app's own copy. It matches the installed version and may list more than this file does:

| Hop | Guide in `node_modules/next/dist/docs/` |
|---|---|
| 12 → 13 | `02-pages/02-guides/upgrading/version-13.md` |
| 13 → 14 | `01-app/02-guides/upgrading/version-14.md` (Pages: `02-pages/...`) |
| 14 → 15 | `01-app/02-guides/upgrading/version-15.md` (Pages: `02-pages/...`) |
| 15 → 16 | `01-app/02-guides/upgrading/version-16.md` (Pages: `02-pages/...`) |
| Codemods | `01-app/02-guides/upgrading/codemods.md` |
| Pages → App | `01-app/02-guides/migrating/app-router-migration.md` |

Run a codemod with the project's package manager (`<dlx> @next/codemod@<v> <transform> <path>`, where `<dlx>` is `yarn dlx`, `npx` or `pnpm dlx`). Use `--dry --print` first on a large tree.

## Minimums per major

| Next | Node | React | Notes |
|---|---|---|---|
| 12 | 12.22 | 17.0.2 or 18 | |
| 13 | 16.14 | 18.2 | IE dropped |
| 14 | 18.17 | 18.2 | |
| 15 | 18.18 | 19 for the App Router; 18.2 or 19 for the Pages Router | ESLint 9 supported |
| 16 | 20.9 | 19 for the App Router; 18.2 or 19 for the Pages Router | TypeScript 5.1; Chrome, Edge and Firefox 111+, Safari 16.4+ |

## 12 → 13

- **React 18.** `@types/react` 18 drops the implicit `children` on `React.FC`: add `children: React.ReactNode` to the props that take it. Effects run twice in development under Strict Mode. Updates are batched everywhere (also in timeouts and promises), so code that read the DOM between two `setState` calls may change. (`upgrade-react-removals`)
- **Tests on React 18:**
  - Enzyme has no React 18 adapter, so a forced change (ask the user);
  - `@testing-library/react` 13+ (16+ with React 19, which also needs `@testing-library/dom` installed alongside);
  - `react-test-renderer` is deprecated in React 19;
  - `act` comes from `react`.
- **`next/image`:** the Next 12 component becomes `next/legacy/image`. Run `next-image-to-legacy-image` to keep the old behaviour, then move to the new `next/image` (`next-image-experimental` handles static usage only; spread props need a hand edit). Next 16 deprecates `next/legacy/image`, so finish the move before the last checkpoint.
- **`next/link`:** the child is no longer an `<a>`. Run `new-link`. Where it adds `legacyBehavior`, rewrite the link by hand (`upgrade-codemod-leftovers`).
- **`next.config`:** `target` is removed (use `output`). `swcMinify` defaults to true; delete the key, since a later major removes it.
- **Fonts:** `@next/font` (13.2) and later `next/font`. Run `built-in-next-font`.
- **Middleware from 12.0/12.1:** nested `pages/**/_middleware.ts` became one root `middleware.ts` in 12.2. Merge them into one file with a `matcher`.
- The `app/` directory is optional. Upgrade mode doesn't add it.

## 13 → 14

- **`next export`** is removed: set `output: "export"` and run `next build`.
- **`ImageResponse`** moves from `next/server` to `next/og`. Run `next-og-import`.
- **`@next/font`** is removed. Run `built-in-next-font` if 13 didn't.
- **Viewport:** `viewport`, `themeColor` and `colorScheme` leave `metadata` for a `viewport` export. Run `metadata-to-viewport-export` (App Router).
- The WASM `next-swc` target is removed.

## 14 → 15

- **React 19** (App Router):
  - `useFormState` becomes `useActionState`;
  - `propTypes` and `defaultProps` on function components are removed (use parameter defaults);
  - string refs, legacy context, `findDOMNode` and `ReactDOM.render` are gone;
  - `useRef()` needs an argument in the types, and `JSX` comes from `React.JSX`.

  The upgrade command runs the React 19 codemods when it upgrades React (`upgrade-react-removals`).
- **Async request APIs** (App Router): `cookies()`, `headers()`, `draftMode()`, `params` and `searchParams` return promises. Run `next-async-request-api`. 15 still allows synchronous access with a warning, and 16 removes it (`upgrade-async-request-apis`).
- **Caching:** `fetch` is no longer cached by default (`cache: "force-cache"` opts in). `GET` route handlers are no longer cached (`dynamic = "force-static"` opts in). The client router cache no longer reuses page segments on navigation (`experimental.staleTimes`). Check pages that relied on the old caching (`upgrade-caching-defaults`).
- **`runtime: "experimental-edge"`** is an error. Run `app-dir-runtime-config-experimental-edge`.
- **Renamed config:** `experimental.serverComponentsExternalPackages` becomes `serverExternalPackages`, and `experimental.bundlePagesExternals` becomes `bundlePagesRouterDependencies`.
- **`NextRequest` `geo` and `ip`** are removed. Run `next-request-geo-ip`, or read the values from the hosting platform's headers.
- **Speed Insights** auto instrumentation is removed.
- **Troubleshooting:** when React 19 or ESLint 9 breaks the install through another package's peer dependencies, the upgrade command takes `--skip-react-upgrade` and `--skip-eslint-upgrade`. Retry the same exact target.

## 15 → 16

- **Runtime:** Node 20.9+, TypeScript 5.1+, the modern browser floor above.
- **Turbopack by default** for `next dev` and `next build`. Drop `--turbopack`/`--turbo` from scripts. A `webpack` hook in `next.config` (yours or a plugin's) fails the build (`upgrade-bundler-explicit`). `experimental.turbopack` moves to a top-level `turbopack`. Sass `~` imports aren't supported (write `@import "pkg/file"`). Webpack `resolve.fallback` becomes `turbopack.resolveAlias`.
- **Async request APIs only:** synchronous access is removed. `params` in metadata image functions (`opengraph-image`, `twitter-image`, `icon`, `apple-icon`) and the `id` in `sitemap` are promises too. `next typegen` (15.5+) generates `PageProps`, `LayoutProps` and `RouteContext`.
- **`middleware` → `proxy`:** rename the file and the exported function (`middleware-to-proxy`), and rename config such as `skipMiddlewareUrlNormalize` to `skipProxyUrlNormalize`. `proxy` runs on Node only; edge middleware stays `middleware.ts` (`upgrade-edge-middleware-not-proxy`).
- **Lint:** `next lint` is removed and `next build` no longer lints. Run `next-lint-to-eslint-cli` and call `eslint` directly in scripts and CI. `eslint-config-next@16` needs ESLint 9+ and defaults to flat config; 16.4+ supports ESLint 10.
- **Caching APIs:** `revalidateTag(tag)` needs a `cacheLife` profile (`revalidateTag(tag, "max")`). Use `updateTag` in a Server Action for read-your-writes, and `refresh()` to refresh the client router.
- **Stabilised APIs:** run `remove-unstable-prefix` (for example `unstable_cacheLife` → `cacheLife`) and `remove-experimental-ppr`. `experimental.dynamicIO` and `experimental.useCache` are removed; their replacement, `cacheComponents`, is not switched on by the upgrade (`upgrade-no-new-defaults`).
- **Parallel routes:** every `@slot` needs a `default.js` (`upgrade-parallel-route-default`).
- **`next/image`:**
  - A local `src` with a query string needs `images.localPatterns[].search`.
  - `minimumCacheTTL` is 4 hours, not 60 seconds.
  - `imageSizes` drops 16.
  - `qualities` defaults to `[75]`; list any other quality the code passes.
  - Optimising images from local IPs is blocked; `dangerouslyAllowLocalIP` is for private networks only.
  - `maximumRedirects` is 3.
  - `next/legacy/image` and `images.domains` are deprecated; use `next/image` and `remotePatterns`.

  (`upgrade-image-defaults`)
- **Removed:**
  - AMP: `next/amp`, `useAmp`, `config.amp`.
  - `serverRuntimeConfig`, `publicRuntimeConfig` and `next/config`: use environment variables read at runtime. The team's way is `nextjs-deploy`'s runtime config; keep the server/client split and read them per request, not at build.
  - Some `devIndicators` options, and `unstable_rootParams`.
- **Scroll:** Next no longer forces `scroll-behavior: auto` during navigation. If the app sets `scroll-behavior: smooth`, read the guide's "Scroll Behavior Override".
- **`next dev` and `next build` can run at the same time** (separate output folders). Remove scripts that worked around the clash.

## 16.x minors

| Minor | Change |
|---|---|
| 16.3 | `experimental.viewTransition` removed (view transitions work without it); `next dev` writes the `nextjs-agent-rules` block into `AGENTS.md`. Keep it. |
| 16.4 | `experimental.appNewScrollHandler` removed (it is the default); `eslint-config-next` supports ESLint 10 |

## Not part of the upgrade

Cache Components (`cacheComponents`), Partial Prefetching, the React Compiler (`reactCompiler`), build adapters, Turbopack file-system caching: each is its own decision after the upgrade (`upgrade-no-new-defaults`).
