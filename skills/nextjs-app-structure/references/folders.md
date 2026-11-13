# Folders

The full layout for a Next.js App Router app (TypeScript, React 19, optionally Tailwind + shadcn, TanStack Query, next-intl, Vitest, Playwright). Paths are relative to `<app-root>` ([SKILL.md](../SKILL.md)).

## The tree

```
<app-root>/             the repo root, or the app's folder (apps/<app-name>/, <app>/)
  app/                  Routes only: pages, layouts, route handlers, and files used by one route
  components/           React components shared by more than one route
    shadcn-ui/          Generated shadcn primitives (the CLI's "ui" alias). Small, commented edits only
    <brand>-ui/         The project's own composites built on the primitives (tables, drawers, dialogs, form rows)
    <area>/             Larger components for one product area, shared by several routes (charts/, nav/, admin/)
    *.tsx               App-wide chrome: shell, sidebar, navbar, breadcrumb, page title
  src/                  Shared non-component code, one folder per kind (table below)
  tests/                Shared test harness, repo-wide rule tests, end-to-end specs
  scripts/              Developer scripts, each behind a package.json script
  public/               Static files served as-is
  proxy.ts | middleware.ts   Request-level routing/gating (proxy.ts on Next 16+)
  next.config.*, tsconfig.json, vitest.config.ts, playwright.config.ts, components.json, eslint.config.*
  AGENTS.md             The app's binding rules for agents (CLAUDE.md can just `@AGENTS.md`)
```

In a monorepo, the repo around the apps:

```
<repo>/
  apps/<app-name>/      One Next app each, every one with the tree above
  packages/
    ui/                 Components shared by several apps (the primitives and composites that would otherwise be copied)
    <domain>/           Shared non-React code: API client and generated types, schemas, utils
    config-typescript/, config-eslint/, config-tailwind/   Shared tsconfig bases and lint/style presets
  package.json (workspaces, packageManager), yarn.lock, .yarnrc.yml, turbo.json | nx.json
  AGENTS.md             Repo-wide rules; each app's AGENTS.md adds its own
```

- An app never imports another app, and never reaches into a package by relative path (`../../packages/ui/src/...`). It depends on the package by name (`"@acme/ui": "workspace:*"`) and imports its exports (`@acme/ui/button`).
- Code moves from an app's `components/` or `src/<kind>/` to `packages/` when a **second app** needs it, the same colocate-first rule one level up.
- A package that ships TypeScript source needs `transpilePackages: ["@acme/ui"]` in each app's `next.config.*`.
- Each app keeps its own `tsconfig.json` (extending the shared base) and its own `@/*` aliases, which resolve inside that app only.

Rules that hold the tree together:
- **Colocate first.** A component, hook, helper, type or schema used by one route lives in that route's folder. It moves to `components/` or `src/<kind>/` when a second route imports it, not before.
- **No top-level twins.** `hooks/`, `utils/`, `types/`, `services/`, ... exist only under `src/`. Never both `<app-root>/utils/` and `<app-root>/src/utils/`.
- **`components/` is for React components only.** A hook, a fetcher or a constant list doesn't go there, even if a component uses it.
- **One primitives folder: `components/shadcn-ui/`.** Point shadcn's `ui` alias at it and ban `@/components/ui` with ESLint `no-restricted-imports`. A project still on shadcn's default `components/ui` moves it in one commit (`git mv`, the alias, the imports).

## `app/`: routes

```
app/
  layout.tsx, globals.css         Root layout (fonts, providers, i18n); theme tokens in globals.css
  (marketing)/, (app)/            Route groups when sections need different layouts; not part of the URL
  <section>/
    layout.tsx, providers.tsx     Section chrome and client providers (query client, toaster)
    _shared/                      Code shared by this section's pages only (underscore: never a route)
    <page>/
      page.tsx                    Server component: metadata, server data, renders <XClient />
      XClient.tsx                 "use client": the interactive page
      <Sub>Dialog.tsx, <Name>Tab.tsx, helpers.ts, types.ts, schema.ts   this page only
      actions.ts                  Server actions used only by this page (else src/services)
      page.test.tsx               The page's test
      loading.tsx, error.tsx, not-found.tsx   when the page needs them
      [id]/                       A record's own page, same shape
  api/<path>/route.ts             Route handlers (or <section>/api/... when scoped to a section)
  [...slug]/                      Catch-all, only for a deliberate fallback (placeholder pages, legacy URLs)
  livez/route.ts, readyz/route.ts Health probes, if the app runs behind an orchestrator
```

- `page.tsx` stays a thin server component; the page's state and handlers live in `XClient.tsx`, named after the page (`UsersClient.tsx`, `InvoiceClient.tsx`).
- A section with many pages gets a hub (`<section>/page.tsx` + `<Section>HubClient.tsx`) or redirects to its first page.
- A catch-all next to real folders must not also generate the real folders' paths: keep an explicit list of the folders it skips.
- Prefix private folders with `_` so the router ignores them. Don't use `_` for anything you mean as a URL segment.

## `src/`: shared code by kind

Ask the first question that fits:

| Folder | Holds | Not here |
|---|---|---|
| `src/utils/` | Pure functions: no React, no network, no `window`, no `process.env`; same input, same output (`format`, `ipcalc`). | Anything that fetches or reads the environment. |
| `src/constants/` | Fixed value lists and settings shared by more than one route (choice lists mirrored from the backend). | Values one page uses; anything computed from the environment. |
| `src/hooks/` | React hooks used by more than one route (`useCurrentUser`, `useCanWrite`). | A hook used by one page. |
| `src/libs/` | Integration code that talks to something outside itself: API client/fetch wrapper, auth client, env reader, analytics, `cn()` (`libs/utils.ts`, where shadcn's `utils` alias points; recent shadcn CLIs write it as a re-export of the `cn` package). | Pure helpers (`utils/`) and hooks (`hooks/`). |
| `src/services/<domain>/` | Data access per backend domain: `index.ts` (reads, query options, query keys), `actions.ts` (`"use server"` writes). Shared plumbing at `src/services/`: `client.ts`, `keys.ts`, `files.ts`, `testing.ts`. | `fetch` calls inside pages or components. |
| `src/api/` | Server-only backend-for-frontend code: session store, token refresh, proxying to the backend, response validation, generated API types (`schema.gen.ts`). Starts files with `import "server-only"`. | Anything a client component imports. |
| `src/schemas/` | zod (or similar) schemas shared by more than one domain, or by a form and its server action. | A schema one page uses. |
| `src/types/` | Types shared across domains (prefer types generated from the API spec). | A page's own `types.ts`. |
| `src/providers/` | A React provider, the context it owns and its `use…` hook, in one file. | A route's `providers.tsx` that only composes these. |
| `src/stores/` | Zustand stores shared by more than one route, each with its provider and `use…` hook in one file (`nextjs-data` references/client-state.md). | Server data (TanStack Query), URL state (`searchParams`), form state; a store one page uses. |
| `src/messages/` | i18n message files (`en.json`, `id.json`, ...), keys namespaced by route (`admin.users.list.title`). | Hard-coded UI strings. |
| `src/i18n/` | i18n request/config (next-intl `request.ts`). | |
| `src/configs/` | Runtime config readers that must be evaluated per request (so one build serves any environment). | Build-time constants. |

Each `src/<kind>/` folder carries a two-line `README.md`: what goes in, how to import it, and a link to the project rule. That stops the folder collecting the wrong things.

**Services pattern** (when the project uses TanStack Query; details in `nextjs-data`):

```ts
// src/services/users/index.ts
export const users = {
  key: (tenant?: string | null) => serviceKey("users", "list", [], tenant),   // [domain, resource, ...params]
  list: (tenant?: string | null) => queryOptions({ queryKey: users.key(tenant), queryFn: () => read<User[]>("users", tenant) }),
};
// src/services/users/actions.ts
"use server";
export async function saveUser(input: unknown) { /* parse with zod, call the backend, return a Result */ }
```

## Import aliases

```jsonc
// tsconfig.json compilerOptions.paths
"@/libs/*": ["./src/libs/*"],
"@/hooks/*": ["./src/hooks/*"],
"@/services/*": ["./src/services/*"],
"@/schemas/*": ["./src/schemas/*"],
"@/types/*": ["./src/types/*"],
"@/stores/*": ["./src/stores/*"],
"@/providers/*": ["./src/providers/*"],
"@/utils/*": ["./src/utils/*"],
"@/constants/*": ["./src/constants/*"],
"@/*": ["./*"]          // @/components/..., @/app/..., @/tests/..., @/src/api/..., @/src/messages/...
```

The specific aliases come before `@/*`. Point shadcn's `components.json` aliases at the same places (`"ui": "@/components/shadcn-ui"`, `"utils": "@/libs/utils"`, `"hooks": "@/hooks"`). Vitest needs the same aliases (`vite-tsconfig-paths` or `resolve.alias`).

## Enforce it

Copy [`templates/src-layout.test.ts`](../templates/src-layout.test.ts) into `<app-root>/tests/` (each app in a monorepo gets its own copy). It fails when a hook lands in `src/libs`, when `src/utils` imports React or does I/O, and when a top-level twin of a `src/` folder appears, each with the move to make. Add to ESLint:
- `no-restricted-imports` for the abandoned primitives path and for `@/src/api/*` from client components.
- A rule or test against `useEffect` fetches if the project uses TanStack Query.

Mention the layout in `AGENTS.md` (a short version of the `src/` table) so every agent and contributor sees it without loading this skill.
