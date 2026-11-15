---
name: nextjs-upgrade
description: "Use when an existing Next.js app on an old major (12 to 15, Pages or App Router) has to reach Next.js 16 or the latest stable release in one go, or move from the Pages Router to the App Router. Upgrade mode keeps the project's own stack (package manager, router, libraries; only what the new versions force changes), optionally with the router move on its own libraries. Migrate mode upgrades first, then moves the app onto the team's stack phase by phase (Yarn 4, App Router, TanStack Query, Server Actions, the BFF, react-hook-form, Tailwind v4, shadcn on Base UI, next-intl, pino, Vitest, Playwright). Covers the baseline, Node 20.9+, React 19, each crossed major's breaking changes and codemods, Turbopack versus webpack, async request APIs, proxy.ts, removed APIs, getServerSideProps and getStaticProps to Server Components, next/router to next/navigation, next/head to metadata, API routes to route handlers, _app and _document to the root layout, both routers side by side, and libraries in the App Router."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps from version 12 on.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# Upgrading an old Next.js app

**Principle:** Reproduce today's behaviour on the new version first; every improvement (a new stack, a new router, a new feature) comes after, in its own change.

The app moves from its current major straight to the target (Next.js 16, or the latest stable release) in one branch. Each major it crosses still gets its own checkpoint commit, so a failure points at one version's changes. Next's own guides are the source for every breaking change: after the target is installed, they are bundled in `node_modules/next/dist/docs/` for every major crossed. [references/version-path.md](references/version-path.md) is the checklist built from them.

Related: `nextjs-package-manager` (Yarn, and converting off npm or pnpm), `nextjs-app-structure` (folders, pages and moving a tree), `nextjs-new-app` (the team's stack in one place, and the enforcement kit), `git-worktree` (the upgrade branch), `git-commit` (checkpoint messages). Details:
- [references/version-path.md](references/version-path.md): each hop from 12 to 16 (Node, React, breaking changes, codemods, what to check), and the 16.x minors
- [references/upgrade-mode.md](references/upgrade-mode.md): upgrade mode step by step, with the project's own package manager
- [references/migrate-mode.md](references/migrate-mode.md): migrate mode: the phases, what each old library maps to, the skill that owns it
- [references/pages-to-app.md](references/pages-to-app.md): Pages Router to App Router: the root layout, moving one route, what maps to what (data fetching, routing hooks, head, API routes, errors, locales), both routers side by side, finishing
- [references/rollout.md](references/rollout.md): staging, production with a rolling update, version skew, shared caches, rollback
- [references/edge-to-proxy.md](references/edge-to-proxy.md): moving edge middleware to `proxy.ts` later, as its own change
- [assets/upgrade-report.md](assets/upgrade-report.md): the report and merge request description
- [references/app-router-libraries.md](references/app-router-libraries.md): what the App Router forces on common libraries (CSS-in-JS, MUI, SWR, Redux, next-auth, next-i18next, next-seo, analytics, Sentry), and the errors met while moving routes

## Pick the mode

| The user wants | Mode | Ends with |
|---|---|---|
| The new Next.js, keeping their own package manager, router and libraries | **Upgrade** | The same app on the target version; only the changes the new versions force |
| The new Next.js and the App Router, keeping their own libraries | **Upgrade, then the router move** | The upgrade merged, then the Pages Router routes moved to `app/` with the same libraries |
| The new Next.js, and the app on the team's stack (the `nextjs-*` skills) | **Migrate** | The upgrade, then one phase per area until the app passes the team's enforcement kit |

When the request doesn't say which, ask. "Upgrade to 16" alone means upgrade mode without the router move. Migrate mode always runs the upgrade first, as its own change (`migrate-after-upgrade`).

## Target version

- **Next.js 16, or the latest stable release:** read the npm `latest` tag with the project's package manager (`yarn npm info next --fields dist-tags`, `npm view next dist-tags`, `pnpm view next dist-tags`). Never use canary, rc or preview.
- **At least two weeks old:** when `latest` is newer than that, take the newest patch of the previous release that is.
- **React:** an App Router app needs React 19. A Pages Router app on 15 or 16 can stay on React 18.2, but take 19 unless a dependency can't.
- **Node 20.9 or later** for Next 16. Prefer the current Node LTS (`upgrade-node-everywhere`).

## Upgrade mode in short

Full steps: [references/upgrade-mode.md](references/upgrade-mode.md).

1. **Inventory:** `bash <this skill>/scripts/inventory.sh <app-root>` prints versions, routers, package manager, config features, middleware, custom server, Babel, lint and test setup, and the libraries that pin React or Next.
2. **Baseline:** on the current version, install, typecheck, lint, test and build. Record the routes table from the build, the test results and failures that already exist, and screenshots of the key pages. Change nothing yet.
3. **Branch:** a worktree or branch for the upgrade (`git-worktree`).
4. **Runtime first:** Node 20.9+ in `.nvmrc`, `engines`, the Dockerfile and CI images, and TypeScript 5.1+. Commit it alone. If the old version doesn't build on the new Node, fold this into the last checkpoint instead.
5. **Install the target once:** `@next/codemod@<v> upgrade <target>` through the project's package manager. It installs Next, React, the types and `eslint-config-next`, and offers the codemods between the two versions. Or install them by hand.
6. **Walk the crossed majors in order** (13 → 14 → 15 → 16). For each one, read its bundled guide, run its codemods (any the upgrade command didn't run, by name), make its manual changes, and commit them as one checkpoint (`upgrade-checkpoint-per-major`). The build only has to be green at the end.
7. **Dependencies:** `bash <this skill>/scripts/peers.sh <app-root> --next <target> --react <react>` lists the libraries whose peer ranges block the target. Upgrade each to a release that supports it, keeping the same library (`upgrade-keep-their-stack`). Enzyme, which has no React 18 adapter, is a forced change.
8. **Resolve every codemod marker** (`upgrade-codemod-leftovers`), then run the scan: `bash <this skill>/scripts/scan.sh <app-root>`. It covers React removals, image defaults and the rest. Write down the caching intent of the reads that relied on the old defaults (`upgrade-caching-defaults`).
9. **Verify against the baseline** (`upgrade-verify-against-baseline`) and report in the shape of [assets/upgrade-report.md](assets/upgrade-report.md).
10. **Roll out** through staging, with the previous image tag ready to roll back to ([references/rollout.md](references/rollout.md), `upgrade-rollout-with-rollback`).

When a direct jump leaves failures that can't be traced to one major, switch to **stepwise**: install each major's last release in turn (`next@13.5`, `14.2`, `15.5`, then the target) and get green at each before moving on.

## Pages Router to App Router in short

Full steps: [references/pages-to-app.md](references/pages-to-app.md). Libraries and errors: [references/app-router-libraries.md](references/app-router-libraries.md).

1. **After the upgrade is merged**, as its own merge request (or migrate mode's phase 4).
2. **Route list:** `bash <this skill>/scripts/routes.sh <app-root>` prints each route and the router serving it (`pages`, `app`, `both`). Add a baseline per route: status, redirects, headers, metadata, screenshot.
3. **Root layout first:** `app/layout.tsx` with what `_document` and `_app` did, and the providers in a `"use client"` file. Keep `_app` and `_document` for the routes not yet moved.
4. **One route or section per commit** (`router-route-by-route`):
   - the page component moves into a client component;
   - `page.tsx` becomes an async Server Component that does what `getServerSideProps` did;
   - `next/head` becomes `metadata`;
   - `next/router` becomes `next/navigation`;
   - the `pages/` file is deleted in the same commit (`router-one-router-per-path`).
5. **Libraries the router forces:** CSS-in-JS registries, per-request stores, auth route handlers, an i18n library without App Router support (a forced change, so ask the user).
6. **`pages/api` last**, as route handlers. Then delete `_app`, `_document` and the `i18n` block, scan, and compare every route with its baseline.

Own stack keeps the page's data and UI code as it is. Team stack gives each moved page the team's shape: a thin server page, TanStack Query, the BFF.

## Migrate mode in short

Full phases: [references/migrate-mode.md](references/migrate-mode.md).

1. **Map:** from the inventory, write one table of area → current library → team target → owning skill, and confirm it with the user. Areas the user keeps stay out of scope.
2. **Phases, in this order, each its own merge request with the app green after it** (`migrate-one-phase-at-a-time`):
   1. Yarn 4 (`nextjs-package-manager`)
   2. The upgrade (upgrade mode above)
   3. Lint and tests (ESLint flat config, Vitest, Playwright)
   4. Pages Router to App Router, route by route (section above, `router-route-by-route`)
   5. Folders (`nextjs-app-structure`)
   6. Data (`nextjs-data`)
   7. Backend access and sign-in (`nextjs-bff`)
   8. Forms (`nextjs-forms`)
   9. UI (`nextjs-ui`)
   10. Strings (next-intl)
   11. Logging and security (`nextjs-logging`, `nextjs-security`)
   12. The image and CI (`nextjs-deploy`)
   13. The enforcement kit and `AGENTS.md` (`nextjs-new-app`)
3. A phase the app already satisfies is skipped and reported, not redone.

## Team decisions

1. **Upgrade mode keeps the project's package manager.** The team's Yarn-only rule (`nextjs-package-manager`, `tool-yarn-only`) applies to team projects and to migrate mode, which converts to Yarn in phase 1. In upgrade mode, run `npx`/`pnpm dlx`/`yarn dlx` as the project does and never add a second lockfile.
2. **Released tooling only:** `@next/codemod` at a pinned released version, never `@canary`. Next's guides also offer `next upgrade --agent`, which runs from `next@canary`. Use it only when the user asks for it.
3. **No new defaults as part of an upgrade:** Cache Components, Partial Prefetching and the React Compiler stay off (`upgrade-no-new-defaults`). The team's apps don't use Cache Components (`nextjs-new-app`, step 3), and turning one on is its own change.
4. **The router move is never part of the version upgrade.** A Pages Router app stays on the Pages Router through the upgrade (Next 16 still supports it). Moving it is a separate merge request after the upgrade: on request in upgrade mode (own libraries), always in migrate mode (phase 4, team stack).
5. **Edge middleware isn't renamed to `proxy.ts`.** `proxy` runs on Node only (`upgrade-edge-middleware-not-proxy`). Moving it later is its own change ([references/edge-to-proxy.md](references/edge-to-proxy.md)).

## Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### Path

| ID | Rule | Impact | Check |
|---|---|---|---|
| [upgrade-checkpoint-per-major](rules/upgrade-checkpoint-per-major.md) | Commit each crossed major's changes as one checkpoint | MEDIUM | review |
| [upgrade-keep-their-stack](rules/upgrade-keep-their-stack.md) | In upgrade mode, change only what the new versions force | MEDIUM | review |
| [upgrade-codemod-leftovers](rules/upgrade-codemod-leftovers.md) | Resolve every codemod marker before calling it done | HIGH | scan |

### Breaking changes

| ID | Rule | Impact | Check |
|---|---|---|---|
| [upgrade-node-everywhere](rules/upgrade-node-everywhere.md) | Raise Node everywhere the app runs, not only locally | HIGH | scan |
| [upgrade-react-removals](rules/upgrade-react-removals.md) | Remove the React APIs that React 18 and 19 dropped | HIGH | scan (candidates) |
| [upgrade-async-request-apis](rules/upgrade-async-request-apis.md) | Await params, searchParams, cookies, headers and draftMode | HIGH | scan (candidates) |
| [upgrade-edge-middleware-not-proxy](rules/upgrade-edge-middleware-not-proxy.md) | Keep edge middleware as middleware; proxy.ts runs on Node | HIGH | scan |
| [upgrade-removed-apis](rules/upgrade-removed-apis.md) | Leave no removed or deprecated API behind | HIGH | scan (candidates) |
| [upgrade-parallel-route-default](rules/upgrade-parallel-route-default.md) | Give every parallel route slot a default file | HIGH | scan |
| [upgrade-bundler-explicit](rules/upgrade-bundler-explicit.md) | Decide Turbopack or webpack when next.config has a webpack hook | MEDIUM | scan |
| [upgrade-caching-defaults](rules/upgrade-caching-defaults.md) | Decide the caching of every read that relied on the old defaults | HIGH | review |
| [upgrade-image-defaults](rules/upgrade-image-defaults.md) | Check next/image against the Next 16 defaults | MEDIUM | scan (candidates) |
| [upgrade-no-new-defaults](rules/upgrade-no-new-defaults.md) | Don't turn on new features to finish an upgrade | MEDIUM | scan |

### Verify

| ID | Rule | Impact | Check |
|---|---|---|---|
| [upgrade-verify-against-baseline](rules/upgrade-verify-against-baseline.md) | Compare the running app with a baseline taken before the upgrade | HIGH | review |
| [upgrade-rollout-with-rollback](rules/upgrade-rollout-with-rollback.md) | Ship through staging with the previous image ready to roll back to | HIGH | review |

### Router

| ID | Rule | Impact | Check |
|---|---|---|---|
| [router-route-by-route](rules/router-route-by-route.md) | Move Pages Router routes to app/ one section at a time | MEDIUM | review |
| [router-one-router-per-path](rules/router-one-router-per-path.md) | Serve each path from one router only | HIGH | scan |
| [router-no-pages-apis-in-app](rules/router-no-pages-apis-in-app.md) | Use no Pages Router API under app/ | HIGH | scan |
| [router-client-boundary](rules/router-client-boundary.md) | Put "use client" on the components that need the browser, not on pages | MEDIUM | scan (candidates) |
| [router-serializable-props](rules/router-serializable-props.md) | Pass only serializable, non-secret data from a Server Component to a client one | MEDIUM | review |

### Migrate

| ID | Rule | Impact | Check |
|---|---|---|---|
| [migrate-after-upgrade](rules/migrate-after-upgrade.md) | Land the version upgrade before any stack change | MEDIUM | review |
| [migrate-one-phase-at-a-time](rules/migrate-one-phase-at-a-time.md) | One area per merge request, the app green after each | MEDIUM | review |

## Reviewing

1. **Scope:** the upgrade branch (`git diff <base>...HEAD`), read checkpoint by checkpoint, plus the inventory and baseline.
2. **Scan:** `bash <this skill>/scripts/scan.sh <app-root>` lists candidates for the rules whose check includes `scan`. Every line is a candidate: open the rule and confirm it before reporting.
3. **Read** each checkpoint against its major's section in [references/version-path.md](references/version-path.md), and against the rules above.
4. **Report** each finding in the format of `agent-skills-authoring` ("Scan scripts and findings"), ordered by impact.
5. **Say what's not covered:** behaviour no test exercises (image quality, caching, scroll, redirects), routes the baseline didn't screenshot, and whether staging was compared.

To test the skill itself, [evals/evals.json](evals/evals.json) holds prompts with the trap each one sets and what a good answer contains.

## Checklist

- [ ] Mode agreed; target is a stable release at least two weeks old; inventory and baseline recorded
- [ ] Node 20.9+ in `.nvmrc`, `engines`, Dockerfile and CI; TypeScript 5.1+; React 19 (or 18.2 on a Pages-only app, with the reason)
- [ ] One checkpoint commit per crossed major; every crossed major's codemods run; no codemod markers left
- [ ] Scan clean or each candidate explained; `next lint` gone from scripts and CI; bundler decided
- [ ] No Cache Components, Partial Prefetching or React Compiler switched on by the upgrade
- [ ] `peers.sh` shows no `blocks`; React 18/19 removals gone; caching intent written down; image qualities and patterns listed
- [ ] Install, typecheck, lint, tests and build pass; `next start` serves the baseline's routes; screenshots match
- [ ] Staging compared with the baseline; the rollback image tag written down; report filled from `assets/upgrade-report.md`
- [ ] Router move (if any): after the upgrade; `routes.sh` shows no `pages` or `both` route; each moved route matches its baseline; `_app`, `_document` and the `i18n` block removed
- [ ] Upgrade mode: the same package manager and libraries. Migrate mode: the upgrade merged first, then one phase per merge request
