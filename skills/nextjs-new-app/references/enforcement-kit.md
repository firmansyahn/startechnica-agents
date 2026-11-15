# Enforcement kit

Copy these into a project so the `eslint` and `test` rules fail the build instead of waiting for a review. Each file lives in the skill that owns its rules, says which rule IDs it enforces, and keeps its settings (folders, allow-lists with reasons) at the top. `nextjs-new-app` copies the default set into a new app; the opt-in files go in once the app has what they check.

## The lint config

[nextjs-new-app/assets/eslint.config.mjs](../../nextjs-new-app/assets/eslint.config.mjs) → `<app-root>/eslint.config.mjs`, or merge its blocks. Every team finding's message ends with `(rule <rule-id>)`.

| Files | Enforces |
|---|---|
| All app code (`app/`, `components/`, `src/`) | `ui-one-primitives-folder`, `forms-no-alert-confirm`, `log-no-console`; the syntax rules of `action-encode-path-segments`, `action-redirect-last`, `data-poll-with-refetchinterval`, `struct-use-aliases`, `ui-literal-class-names`, `ui-gap-not-space`, `ui-no-dark-overrides`, `ui-cn-merge-classes`, `forms-controls-match-schema-type`, `forms-default-values`, `forms-validate-on-touch`, `forms-zod-4-api`, `forms-submit-enabled-when-invalid`, `log-errors-under-err`, `log-no-whole-headers`, `log-structured-request-id` (message half), `contract-snake-case-names`, `react/no-array-index-key` (`forms-field-array-keys`); warns on literal color classes (`ui-theme-tokens-only`), fixed overlays (`ui-existing-primitive-first`) and raw ids in other calls (`contract-opaque-encoded-ids`) |
| Pages and components (`app/`, `components/`) | `data-no-fetch-in-components` (route handlers excepted), `ui-existing-primitive-first`, `ui-table-primitive`, `ui-table-row-actions`, `ui-table-headers-numbers`, `ui-cards-group-not-decorate`, `ui-button-pending-state`, `ui-button-icon-data-icon`, `ui-icon-no-size-in-primitives`, `ui-icon-library-lucide`, `ui-no-overlay-z-index`, `ui-visible-labels`, `i18n-use-formatters` (also `ui-dates-formatted`), `i18n-variables-not-concatenation`, `store-named-actions`, `store-no-set-during-render`, forms selectors (`forms-controller-for-callback-controls`, `forms-select-items-labels`); `jsx-a11y` for `ui-keyboard-operable` and `ui-visible-labels`; `react/jsx-no-literals` and literal-prop selectors for `i18n-strings-from-messages` |
| Pages, components and browser code (no route handlers) | `data-query-key-factory`, `data-query-options-from-registry`, `sec-env-access-limited` |
| Browser code (`*Client.tsx`, `components/`, `src/hooks/`, `src/providers/`) | `struct-server-only` (runtime imports of `src/api/`) |
| `app/` | `ui-confirm-composite` (the alert dialog only through the composite), `ui-page-title-component` (no raw `h1`; `APP_OWN_HEADING` lists error pages and a landing page) |
| `app/**/page.tsx` | `page-thin-server-page` (no `"use client"`) |
| `src/services/**/actions.ts` | `bff-writes-via-apiaction` (no `fetch`, no `axios`) |
| `proxy.ts`, `middleware.ts` | `bff-matcher-matches-prefixes` (a literal `config.matcher`) |
| `next.config.*` | `bff-no-env-in-next-config` |
| Monorepo packages | `struct-no-cross-app-imports` (`import/no-relative-packages`, no `@scope/pkg/src` imports) |
| Unit tests (`*.test.ts(x)`) | `page-test-query-by-role` and `ui-test-by-role` (`testing-library/no-container`, `no-node-access`, no `*ByTestId`), `forms-test-like-a-user` (`testing-library/prefer-user-event`), `e2e-spec-suffix` (no `@playwright/test` values) |
| Playwright specs (`*.spec.ts`, `playwright.config.*`) | `e2e-one-locator-one-element`, `e2e-web-first-assertions` (`eslint-plugin-playwright`), `e2e-mask-dynamic-regions` (screenshot thresholds), `e2e-spec-suffix` (no `vitest`) |

Settings at the top of the file: the folder sets, `TRANSPORTS` (the project's transport function names), `APP_OWN_HEADING`, `ICONS_DIR` (brand glyphs that draw their own `<svg>`). The generated primitives (`components/shadcn-ui/**`) and tests are exempt from the team syntax rules.

- **Silence one finding** with a reason: `// eslint-disable-next-line team/syntax-<set> -- <reason>` (the rule name is in the message's rule ID: `team/syntax-code`, `team/syntax-ui`, `team/syntax-view`, `team/syntax-app`, `team/syntax-page`, `team/syntax-test`, ...). An untranslated legacy page gets one file-level `/* eslint-disable react/jsx-no-literals -- <reason> */` until it is translated.
- **`react/jsx-no-literals` makes every literal JSX text an error** in `app/` and `components/`. On an existing app, run it once and either translate or disable per file while the strings move to `src/messages/`.

## The rule tests

| File | Copy to | Enforces |
|---|---|---|
| [nextjs-ui/assets/tests/theme-tokens.test.ts](../../nextjs-ui/assets/tests/theme-tokens.test.ts) | `tests/` | `ui-theme-tokens-only`, `ui-icon-color-from-text`: palette, white/black, hex and color-function classes, with a suggested token per hit; `ALLOWED` entries (file + pattern + reason) fail when stale |
| [nextjs-ui/assets/tests/size-shorthand.test.ts](../../nextjs-ui/assets/tests/size-shorthand.test.ts) | `tests/` | `ui-size-shorthand`: `w-N h-N` pairs that should be `size-N` |
| [nextjs-ui/assets/tests/axe.ts](../../nextjs-ui/assets/tests/axe.ts) | `tests/` (a helper, beside `render.tsx`) | `expectAccessible()` for page tests: `ui-heading-hierarchy` and the runtime half of `ui-visible-labels` (axe in jsdom) |
| [nextjs-bff/assets/tests/server-only.test.ts](../../nextjs-bff/assets/tests/server-only.test.ts) | `tests/` | `struct-server-only`: every `src/api/` module and every shared module using a server API imports `server-only`; `"use client"` files import only types from `src/api/` (`CLIENT_SAFE` lists the shared `result.ts`) |
| [nextjs-data/assets/tests/no-effect-fetch.test.ts](../../nextjs-data/assets/tests/no-effect-fetch.test.ts) | `tests/` | `data-no-effect-fetch`, `data-no-writes-in-effects`: a `useEffect` that fetches, calls a server action or fires a mutation, directly or through the file's functions; `EXEMPT` only shrinks |
| [nextjs-data/assets/tests/use-server-exports.test.ts](../../nextjs-data/assets/tests/use-server-exports.test.ts) | `tests/` | `action-use-server-exports`, `action-file-per-domain`, `forms-schema-outside-use-server`, `sec-action-validate-unknown`, `bff-writes-via-apiaction`: non-async exports, inline `"use server"` functions, typed or unparsed action inputs, `fetch` in an action |
| [nextjs-data/assets/tests/action-calls.test.ts](../../nextjs-data/assets/tests/action-calls.test.ts) | `tests/` | `data-mutation-via-runaction`, `forms-submit-via-mutation`, `action-writes-only`: actions called through `runAction` in a `mutationFn`, never in a `queryFn` or `Promise.all` |
| [nextjs-data/assets/tests/optimistic-updates.test.ts](../../nextjs-data/assets/tests/optimistic-updates.test.ts) | `tests/` | `data-optimistic-with-rollback`: `onMutate` with `setQueryData` also cancels, rolls back and invalidates |
| [nextjs-data/assets/tests/stores.test.ts](../../nextjs-data/assets/tests/stores.test.ts) | `tests/` | `store-narrow-selectors`, `store-persist-preferences-only` |
| [nextjs-app-structure/templates/locale-parity.test.ts](../../nextjs-app-structure/templates/locale-parity.test.ts) | `tests/` | `i18n-key-in-every-locale`: every key in every `src/messages/<locale>.json`, and every literal `t("key")` (with its `useTranslations`/`getTranslations` namespace) exists |
| [nextjs-app-structure/templates/metadata-translated.test.ts](../../nextjs-app-structure/templates/metadata-translated.test.ts) | `tests/` | `i18n-metadata-translated` |
| [nextjs-app-structure/templates/src-layout.test.ts](../../nextjs-app-structure/templates/src-layout.test.ts) | `tests/` | `struct-src-folder-kinds`, `struct-no-top-level-twins`, `struct-components-only-react`, `struct-src-folder-readme` |
| [nextjs-app-structure/templates/test-layout.test.ts](../../nextjs-app-structure/templates/test-layout.test.ts) | `tests/` | `page-test-beside-code`, `page-test-suffix-environment` |
| [nextjs-app-structure/templates/page-tests.test.ts](../../nextjs-app-structure/templates/page-tests.test.ts) | `tests/` | `page-test-every-page`, `page-test-second-locale` (once a second locale exists), and that each page test calls `expectAccessible()` |
| [nextjs-security/assets/tests/route-handlers.test.ts](../../nextjs-security/assets/tests/route-handlers.test.ts) | `tests/` | `sec-route-handler-auth-origin`: a session check in every route handler, an origin check in every write export, no write in a `GET` (`PUBLIC` lists the probes) |
| [nextjs-e2e/assets/tests/e2e-setup.test.ts](../../nextjs-e2e/assets/tests/e2e-setup.test.ts) | `tests/` | the Playwright config and its CI job: `e2e-ci-production-build`, `e2e-health-route-ready`, `e2e-flaky-is-failing`, `e2e-freeze-motion`, `e2e-keep-traces`, `e2e-image-matches-playwright`, `e2e-review-baseline-updates` (needs `@playwright/test` and a CODEOWNERS entry for `__screenshots__`) |
| [nextjs-new-app/assets/src/libs/logger.test.ts](../assets/src/libs/logger.test.ts) | `src/libs/` | `log-redaction-test`: credentials come out redacted through the logger's `REDACT` |

**Opt-in**, once the app has what they check:

| File | Copy to | When |
|---|---|---|
| [nextjs-app-structure/templates/access-map.test.ts](../../nextjs-app-structure/templates/access-map.test.ts) | `tests/` | the app has a route → permission map (`page-central-access-map`) |
| [nextjs-ui/assets/tests/form-overlay.test.tsx](../../nextjs-ui/assets/tests/form-overlay.test.tsx) | beside the form drawer/dialog composite | `ui-overlay-form-state` |
| [nextjs-logging/assets/tests/client-error-endpoint.test.ts](../../nextjs-logging/assets/tests/client-error-endpoint.test.ts) | beside the client-error route | `log-client-endpoint-limited` |

**Browser specs and CI** (Playwright runs them; `nextjs-e2e`): [nextjs-security/assets/e2e/security-headers.spec.ts](../../nextjs-security/assets/e2e/security-headers.spec.ts) (headers, CSP, framing, exact origins, the theme script per theme) and [nextjs-e2e/assets/layout.spec.ts](../../nextjs-e2e/assets/layout.spec.ts) (`ui-mobile-first`, `ui-table-scroll-container` at 400 px) → `tests/e2e/`. [nextjs-security/assets/ci/security.gitlab-ci.yml](../../nextjs-security/assets/ci/security.gitlab-ci.yml) adds the framework-advisory and prerendered-nonce-page jobs.

## Install

1. `yarn add -D eslint eslint-config-next eslint-plugin-testing-library eslint-plugin-playwright vitest axe-core` (and `yarn add server-only`, which the marked modules import). Add scripts: `"lint": "eslint ."`, `"test": "vitest run"`.
2. Copy `eslint.config.mjs`, or merge its blocks into the existing config. One rule is configured once per file: keep each `no-restricted-imports`/`no-restricted-globals` list complete in the block that matches, as the file does; the team syntax selectors each have their own `team/syntax-*` copy, so a new selector goes into its list only.
3. Copy the tests into `<app-root>/tests/` (the logger test into `src/libs/`). The `.test.ts` ones run in Vitest's `node` project without a DOM, and they read files from `<app-root>` (one folder up), so a monorepo copies them into each app.
4. Vitest can't load `server-only` outside Next (its default entry throws). Point it at an empty module in `vitest.config.*`: `resolve: { alias: [{ find: /^server-only$/, replacement: path.resolve(__dirname, "tests/server-only.stub.ts") }] }` with an empty `tests/server-only.stub.ts` (`export {};`), or `vi.mock("server-only", () => ({}))` in the test, as the logger test does.
5. Run them once on an existing app: each failure lists the file, line and fix. Fix what's cheap, put the rest in the test's allow-list or `EXEMPT` with a reason (the list only shrinks: a stale entry fails), or narrow the swept folders at the top of the test while an older part of the app moves over.

The tests read source text with regular expressions, not a parsed syntax tree: they catch the common shapes and say in their header what they miss (dynamic translation keys, a fetch hidden behind a hook or a prop). Review covers the rest.
