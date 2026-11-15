---
name: nextjs-app-structure
description: "Use when setting up, auditing, reorganising, or adding to a Next.js App Router app, new or existing, at the repo root, in its own folder beside a backend, or as apps/<app-name>/ in a monorepo: where a route, page, component, hook, service, server action, schema, type, util, provider, message file or test belongs, import aliases, migrating an existing tree step by step and enforcing it with a test; and how a page is built: building, porting, refactoring, reviewing or testing an admin/console page, a list, a create/edit form, a settings page, a record's detail page, a shared component or a hook (thin server page + client component, data through TanStack Query and server actions, toasts and in-app confirms, read-only users, next-intl strings, theme tokens, page tests that fake the network, screenshots)."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.2.0"
---

# Next.js app structure: folders and page anatomy

**Principle:** Every file has one obvious place and every page one shape: a thin server page, a client component named after it, and strings from the message files.

Where files go, and what goes in them. The layout keeps routing in `app/`, shared React components in `components/`, every other kind of shared code in its own `src/<kind>/` folder, and code beside the one route that uses it until a second one needs it. Every page is a thin server `page.tsx` plus one client component, reading through TanStack Query and writing through server actions.

Related: `nextjs-data` (reads and writes), `nextjs-forms` (create/edit forms), `nextjs-ui` (Tailwind tokens, shadcn primitives and composites, themes), `nextjs-bff` (how calls reach the backend), `nextjs-logging`, `nextjs-package-manager` (every command runs through Yarn 4, never npm, npx or pnpm), `nextjs-new-app` (scaffolding a new app on this layout), `nextjs-deploy` (the runtime image and CI).

**Where the app lives (`<app-root>`).** Every path here is relative to the Next app's own root, the folder holding its `package.json` and `next.config.*`: its own top-level folder beside a non-JS backend, `apps/<app-name>/` in a workspace monorepo (shared code in `packages/<name>/`), or the repo root when the repo is only the Next app. Find it first (`next.config.*`, the workspace list in `package.json`, `turbo.json`, `nx.json`). For a new app use its own folder (`<app>/`) or `apps/<app-name>/` unless the user says otherwise.

**The project wins.** Its `AGENTS.md`, `CLAUDE.md`, folder READMEs and any project-specific web skill override this skill where they differ; they also name the project's own components for the generic roles below (form drawer, row state, confirm dialog, page title, write-aware button).

**Check the Next version first** (`<app-root>/node_modules/next/package.json`, or the monorepo root's when hoisted). Next 16 renamed `middleware.ts` to `proxy.ts`; `params` became a Promise in 15. If `node_modules/next/dist/docs/` exists, read the page there before using an API you're unsure of.

Two modes:
- **New project:** scaffold the tree, then add folders as the first file for each arrives (no empty placeholder folders beyond a README).
- **Existing project:** audit, then migrate in small moves ([references/migration.md](references/migration.md)). Never reorganise a whole tree in one commit.

## Read the reference for the task

| Task | Reference |
|---|---|
| The full tree, monorepo layout, `app/` routes, the `src/<kind>/` table, the services pattern, aliases, enforcement | [references/folders.md](references/folders.md) |
| Building a page: reference page, reading, writing, settings pages, strings, look | [references/page-anatomy.md](references/page-anatomy.md) |
| Where tests go, the Vitest split, page tests that fake the network, screenshots | [references/testing.md](references/testing.md) |
| Moving an existing project onto this layout | [references/migration.md](references/migration.md) |

## Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### Folders

| ID | Rule | Impact | Check |
|---|---|---|---|
| [struct-colocate-until-shared](rules/struct-colocate-until-shared.md) | Keep code beside its one route until a second route needs it | LOW | review |
| [struct-src-folder-kinds](rules/struct-src-folder-kinds.md) | Put shared code in the src folder for its kind | LOW | test: nextjs-app-structure template |
| [struct-no-top-level-twins](rules/struct-no-top-level-twins.md) | No top-level twins of src folders | LOW | test: `templates/src-layout.test.ts` |
| [struct-components-only-react](rules/struct-components-only-react.md) | components/ holds React components only | LOW | test, review |
| [struct-use-aliases](rules/struct-use-aliases.md) | Imports use the aliases, not long relative paths | LOW | eslint |
| [struct-no-cross-app-imports](rules/struct-no-cross-app-imports.md) | Apps never import each other | LOW | eslint |
| [struct-private-folders-underscore](rules/struct-private-folders-underscore.md) | Private route folders start with an underscore | LOW | scan (candidates), review |
| [struct-src-folder-readme](rules/struct-src-folder-readme.md) | A new src folder gets a README | LOW | test, review |

### Pages

| ID | Rule | Impact | Check |
|---|---|---|---|
| [page-copy-reference-page](rules/page-copy-reference-page.md) | Copy the reference page, not the nearest page | MEDIUM | review |
| [page-thin-server-page](rules/page-thin-server-page.md) | page.tsx is a thin server component | MEDIUM | eslint, review |
| [page-client-named-after-page](rules/page-client-named-after-page.md) | The client component is named after the page | MEDIUM | scan, review |
| [page-central-access-map](rules/page-central-access-map.md) | Access is declared once, centrally | MEDIUM | test, scan (candidates), review |
| [page-form-drawer-composite](rules/page-form-drawer-composite.md) | Create and edit happen in the form drawer or dialog composite | MEDIUM | review |
| [page-read-only-context](rules/page-read-only-context.md) | Read-only users see disabled controls through one context | MEDIUM | review |
| [page-settings-hook](rules/page-settings-hook.md) | Settings pages use the settings hook | MEDIUM | review |
| [page-one-scope-source](rules/page-one-scope-source.md) | One page, one scope source | MEDIUM | review |

### Strings

| ID | Rule | Impact | Check |
|---|---|---|---|
| [i18n-strings-from-messages](rules/i18n-strings-from-messages.md) | Every visible string comes from the message files | MEDIUM | eslint, review |
| [i18n-keys-by-route](rules/i18n-keys-by-route.md) | Keys are namespaced by route | MEDIUM | review |
| [i18n-key-in-every-locale](rules/i18n-key-in-every-locale.md) | Every key exists in every locale | MEDIUM | test: `templates/locale-parity.test.ts` |
| [i18n-metadata-translated](rules/i18n-metadata-translated.md) | Metadata comes from translations | MEDIUM | test, review |
| [i18n-no-mixed-strings](rules/i18n-no-mixed-strings.md) | Never mix translated and hard-coded strings in one page | MEDIUM | review |
| [i18n-variables-not-concatenation](rules/i18n-variables-not-concatenation.md) | Messages carry variables, not concatenation | MEDIUM | eslint, review |
| [i18n-use-formatters](rules/i18n-use-formatters.md) | Numbers and dates go through the formatters | MEDIUM | eslint, review |
| [i18n-backend-messages-as-sent](rules/i18n-backend-messages-as-sent.md) | Backend messages are shown as sent, not translated by key guessing | MEDIUM | review |

### Testing

| ID | Rule | Impact | Check |
|---|---|---|---|
| [page-test-beside-code](rules/page-test-beside-code.md) | Tests sit beside the code they test | LOW | test |
| [page-test-suffix-environment](rules/page-test-suffix-environment.md) | The suffix picks the environment | LOW | test, review |
| [page-test-every-page](rules/page-test-every-page.md) | Every page has a page test | LOW | test, review |
| [page-test-one-behaviour](rules/page-test-one-behaviour.md) | One behaviour per test | LOW | review |
| [page-test-query-by-role](rules/page-test-query-by-role.md) | Query by role and name | LOW | eslint, review |
| [page-test-read-only-user](rules/page-test-read-only-user.md) | The read-only user is tested | LOW | review |
| [page-test-second-locale](rules/page-test-second-locale.md) | A second locale renders | LOW | test |
| [page-test-screenshots-light-dark](rules/page-test-screenshots-light-dark.md) | Visual changes are looked at in light and dark | LOW | review |
| [page-test-run-related](rules/page-test-run-related.md) | Run the related tests while working, the suite before merging | LOW | ci (`nextjs-deploy` pipeline: typecheck, lint, `yarn test` on every MR), review |

## The tree, short

```
<app-root>/
  app/                  Routes only: page.tsx + XClient.tsx + this page's own files, route handlers
  components/
    shadcn-ui/          Generated shadcn primitives (the CLI's "ui" alias)
    <brand>-ui/         The project's composites on the primitives
    <area>/, *.tsx      Area components shared by several routes; app chrome
  src/<kind>/           utils, constants, hooks, libs, services/<domain>, api (server-only), schemas, types, providers, messages, i18n, configs
  tests/                Harness, repo-wide rule tests, end-to-end specs
  proxy.ts              Request routing and gating (middleware.ts before Next 16)
```

## A page, short

```
app/<section>/<page>/
  page.tsx        server component: generateMetadata from translations, renders <XClient />
  XClient.tsx     "use client": the page's state, queries, mutations and handlers
  <Sub>Dialog.tsx | helpers.ts | types.ts | schema.ts | actions.ts   this page only
  page.test.tsx
  [id]/           the record's own page, same shape
```

## Where a new thing goes

| You are adding | Put it in |
|---|---|
| A page | `app/<section>/<page>/` with `page.tsx`, `XClient.tsx`, `page.test.tsx`; its strings in every message file; its access entry; its menu entry if the app has a menu data file |
| A record's detail page | `app/<section>/<page>/[id]/` |
| An HTTP endpoint served by Next | `app/<path>/route.ts`; paths owned by another backend go through `proxy.ts` rewrites instead |
| Reads/writes for a backend domain | `src/services/<domain>/index.ts` + `actions.ts` (`nextjs-data`) |
| A component for one page / one section / many sections | Beside the page / the section's `_shared/` / `components/` (primitive via the shadcn CLI in `components/shadcn-ui`, composite in `components/<brand>-ui`, area component in `components/<area>/`) |
| A hook, helper, type or schema | Beside its page; `src/hooks/`, `src/utils/`, `src/types/`, `src/schemas/` once a second route needs it |
| Code that touches network, env or browser APIs | `src/libs/` (client-safe) or `src/api/` (server-only) |
| A context | `src/providers/<Name>.tsx` with its provider and hook |
| Client-only state shared by distant components | A Zustand store beside its one route, or `src/stores/<name>.tsx` once shared (`nextjs-data`) |
| A developer script | `scripts/` plus a `package.json` script |
| Code a second app needs (monorepo) | `packages/<name>/`, imported by package name |

## Rules that hold everywhere

1. **Colocate first**: code used by one route lives in its folder and moves to `components/` or `src/<kind>/` when a second route imports it.
2. **No top-level twins** (`<app-root>/utils/` beside `src/utils/`); `components/` holds React components only; one primitives folder, `components/shadcn-ui/`.
3. **Server-only code is marked** (`import "server-only"` in `src/api/` and server helpers); client components never import it.
4. **Find the reference page first** and copy its shape; never copy a page that fetches in `useEffect`, builds its own dialogs, or calls `alert()`/`confirm()`.
5. **`page.tsx` is a thin server component**; the interactive page is `XClient.tsx`.
6. **Data through `nextjs-data`**: `useQuery` on the services registry, writes as server actions returning a `Result`; no `fetch` in pages.
7. **Access is central**: one route → permission map, the same permission on the backend route; read-only users see disabled write controls through one write-permission context.
8. **Questions through the confirm dialog, feedback through toasts or an in-form notice**; never `alert()`/`confirm()`.
9. **Every string translated in every locale**, metadata from translations; theme tokens and the project's primitives/composites only.
10. **Tests fake the network, not the code**; screenshots in light and dark for any visual change.

## Reviewing

1. **Scope.** The diff (`git diff <base>...HEAD`), a merge request's files or the whole app, read for what this skill covers: the folders, pages, strings and page tests it changes.
2. **Scan.** `bash <this skill>/scripts/scan.sh <app-root>` lists candidates for the rules whose check includes `scan`. On a diff, keep only findings in changed lines or files. Every line is a candidate: open the rule and confirm it before reporting.
3. **Read** the changed code against the Rules above. Open each rule you cite and match its "Incorrect" shape, not just its title.
4. **Report** each finding in the format of `agent-skills-authoring` ("Scan scripts and findings"): impact, rule ID, file and line, what to change citing the rule's "Correct" shape; ordered by impact. Raise the impact one level on an authentication, payment or deletion path.
5. **Say what's not covered:** rules whose check is `test` or `eslint` but the project has no such test or lint rule (the tests are in `templates/`, listed in [references/folders.md](references/folders.md) "Enforce it"). `kit` in the Check column means a ready-to-copy check exists (`nextjs-new-app`, references/enforcement-kit.md).

## Checklist

- [ ] Files in the right folder: colocated until shared, no twins, primitives in `components/shadcn-ui/`, server code marked server-only
- [ ] `page.tsx` thin; `XClient.tsx` holds the page; access entry added and matching the backend route's permission
- [ ] Data through `useQuery`/`useMutation` on the services registry; no `useEffect` fetch; no `fetch` in the page
- [ ] Writes are server actions returning a `Result`; PATCH sends only changed fields; the scope is in the input
- [ ] Forms on react-hook-form + zod with server field errors on the fields (`nextjs-forms`)
- [ ] Read-only user respected; confirm dialog and toasts, no `alert`/`confirm`
- [ ] Theme tokens only; primitives and composites only; works in light and dark
- [ ] Strings in every locale file; metadata from translations
- [ ] `page.test.tsx` covers the calls, validation and the read-only user; the layout test and the enforcement kit (`nextjs-new-app` references/enforcement-kit.md) pass; screenshots looked at
