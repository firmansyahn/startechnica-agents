# Migrate mode

The app ends on the team's stack, the one `nextjs-new-app` sets up for a new app, reached in phases from what it has today. The upgrade comes first and lands on its own (`migrate-after-upgrade`). After that, each phase is one area, one merge request, and the app is green after it (`migrate-one-phase-at-a-time`).

## 1. The map

From the inventory, fill this table for the app and confirm it with the user before phase 1. The user may keep an area as it is (a UI kit they are not ready to replace, an auth provider other apps share). Mark it "kept" with the reason; it is out of scope.

| Area | Looks like today | Team target | Owner |
|---|---|---|---|
| Package manager | `package-lock.json`, `pnpm-lock.yaml`, Yarn 1 | Yarn 4 pinned by a committed `yarnPath` release | `nextjs-package-manager` |
| Next, React, Node | 12–15, React 17/18 | The target, React 19, Node LTS | this skill, upgrade mode |
| Lint | `.eslintrc*`, `next lint` | Flat `eslint.config.mjs` with the team's blocks | `nextjs-new-app` (enforcement kit) |
| Unit tests | Jest, Enzyme, none | Vitest (`node` and `dom` projects), Testing Library, fakes for the network | `nextjs-app-structure` references/testing.md |
| Browser tests | Cypress, none | Playwright | `nextjs-e2e` |
| Router | `pages/` | `app/`, thin server `page.tsx` plus a client component | [pages-to-app.md](pages-to-app.md), `nextjs-app-structure` |
| Folders | `lib/`, top-level `hooks/`, `utils/`, `components/ui` | `src/<kind>/`, `components/shadcn-ui`, aliases | `nextjs-app-structure` references/migration.md |
| Reads | `getServerSideProps`, SWR, React Query v3/v4, Redux thunks, `useEffect` + `fetch`/axios | TanStack Query v5 with a services registry | `nextjs-data` |
| Writes | API routes called from the client, Redux actions | Server Actions returning `Result`, `useMutation` with `runAction` | `nextjs-data` |
| Shared client state | Redux, Context stores, MobX | Zustand, only for real client state | `nextjs-data` |
| Backend access, sign-in | Tokens in `localStorage` or cookies the browser reads, next-auth, a client SDK | BFF: an opaque session cookie, tokens on the server, a reads proxy | `nextjs-bff`, `oauth-client` |
| Forms | Formik, uncontrolled forms, yup | react-hook-form + zod (shared with the action), shadcn `Field` | `nextjs-forms` |
| UI | Tailwind v3, MUI, Chakra, Ant Design, Bootstrap, styled-components, emotion, CSS Modules | Tailwind v4 (CSS-first), shadcn on Base UI in `components/shadcn-ui`, theme tokens | `nextjs-ui` |
| Strings | next-i18next, next-translate, hard-coded, `next.config` `i18n` | next-intl, `src/messages/<locale>.json` | `nextjs-app-structure` (Strings rules) |
| Logging and errors | `console.*`, winston, a vendor SDK only | pino JSON to stdout, `instrumentation.ts`, request ids | `nextjs-logging` |
| Security | No CSP, headers in `next.config` | CSP with nonces in `proxy.ts`, security headers, data access layer | `nextjs-security` |
| Build and run | `output: "standalone"`, `NEXT_PUBLIC_*` settings, `next.config` `env`, `publicRuntimeConfig` | One image running `next start`, settings read at runtime, `/livez` and `/readyz` | `nextjs-deploy` |

## 2. The phases, in order

Each phase reads its owning skill first and ends with that skill's "Reviewing". Commit inside a phase in small moves; the merge request is the phase.

1. **Yarn 4** (`nextjs-package-manager` section 6). This goes first, so every later install goes through Yarn. It changes no behaviour: the build output and tests are the same before and after.
2. **The upgrade:** [upgrade-mode.md](upgrade-mode.md), now with Yarn. Merge it before anything else changes.
3. **Lint and tests:**
   - flat ESLint with Next's config, without the team's restricted-import blocks yet: they would fail on code the later phases replace;
   - Jest to Vitest (keep the test bodies, swap the runner and the setup);
   - Cypress to Playwright, or a first Playwright smoke test of the baseline's routes.

   Later phases lean on these tests.
4. **Router:** Pages Router to App Router, route by route, on the team stack track ([pages-to-app.md](pages-to-app.md), `router-route-by-route`). Libraries the router forces are replaced by their team targets here only when their own phase is this one; otherwise they get their App Router setup now and move in their phase ([app-router-libraries.md](app-router-libraries.md)). Skip it if the app already uses only `app/`.
5. **Folders:** `nextjs-app-structure` references/migration.md (aliases first, then one folder kind per commit).
6. **Data:** reads to TanStack Query and a services registry, writes to Server Actions, Redux to Zustand or server state. Do one domain at a time (customers, then orders), with that domain's page tests faking the network.
7. **Backend access and sign-in:** the BFF (`nextjs-bff`, `oauth-client` references/web-bff-client.md). Tokens leave the browser in this phase. It touches every authenticated call, so ship it behind the sign-in round-trip test from phase 3.
8. **Forms:** one form per commit (`nextjs-forms`); zod schemas shared with the phase-6 actions.
9. **UI:**
   - Tailwind v3 to v4 first (`nextjs-ui` references/tailwind.md);
   - then the primitives to shadcn on Base UI, screen by screen;
   - then hard-coded colors onto theme tokens.

   A Radix-based shadcn project stays on Radix unless the user wants Base UI (`nextjs-ui`, "Rules that hold everywhere", rule 4).
10. **Strings:** next-intl, with every string moved into `src/messages/<locale>.json` and the locale-parity test added.
11. **Logging and security:** the pino logger and `instrumentation.ts` (`nextjs-logging`), then CSP and headers (`nextjs-security`). Roll CSP out report-only first.
12. **Build and run:** `nextjs-deploy`:
    - drop `output: "standalone"`;
    - settings read at runtime, not `NEXT_PUBLIC_*`;
    - the probes;
    - the multi-stage Dockerfile;
    - the CI pipeline.
13. **Enforcement:** copy the enforcement kit (`nextjs-new-app` references/enforcement-kit.md) and fix what it finds. Entries that can't be fixed yet go in its allow-lists with reasons. Then add the team's `AGENTS.md` section below the generated `nextjs-agent-rules` block.

## 3. When a phase is done

- The owning skill's checklist passes for the code the phase touched.
- The app is green: frozen install, typecheck, lint, tests, build, `next start`, and the baseline's routes and screenshots.
- The report says what moved, what is left (with the files), and any area the user kept. Use [assets/upgrade-report.md](../assets/upgrade-report.md) with the phase's area in the title.
- A phase that changes what users see goes out through staging with a rollback image ([rollout.md](rollout.md)).

Don't start a phase while the previous one is unmerged. A phase that would take weeks splits by route or domain into several merge requests, each still green.
