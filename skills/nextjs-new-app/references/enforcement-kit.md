# Enforcement kit

Copy these into a project so the `eslint` and `test` rules fail the build instead of waiting for a review. Each file lives in the skill that owns its rules, says which rule IDs it enforces, and keeps its settings (folders, allow-lists with reasons) at the top. `nextjs-new-app` copies all of them into a new app.

| File | Copy to | Enforces |
|---|---|---|
| [nextjs-new-app/assets/eslint.config.mjs](../../nextjs-new-app/assets/eslint.config.mjs) | `<app-root>/eslint.config.mjs`, or merge its marked blocks | `ui-one-primitives-folder` (no `@/components/ui`), `log-no-console`, `forms-no-alert-confirm` (globals and `window.*`), `data-no-fetch-in-components` (`fetch`, `axios` in `app/` and `components/`), `struct-server-only` (runtime imports of `src/api/` from client folders); warns on literal color classes (`ui-theme-tokens-only`) |
| [nextjs-ui/assets/tests/theme-tokens.test.ts](../../nextjs-ui/assets/tests/theme-tokens.test.ts) | `<app-root>/tests/` | `ui-theme-tokens-only`: palette, white/black, hex and color-function classes, with a suggested token per hit; `ALLOWED` entries (file + pattern + reason) fail when stale |
| [nextjs-bff/assets/tests/server-only.test.ts](../../nextjs-bff/assets/tests/server-only.test.ts) | `<app-root>/tests/` | `struct-server-only`: every `src/api/` module and every shared module using a server API imports `server-only`; `"use client"` files import only types from `src/api/` (`CLIENT_SAFE` lists the shared `result.ts`) |
| [nextjs-data/assets/tests/no-effect-fetch.test.ts](../../nextjs-data/assets/tests/no-effect-fetch.test.ts) | `<app-root>/tests/` | `data-no-effect-fetch`: a `useEffect` that fetches directly, through the file's functions, an exported fetching helper or a server action; `EXEMPT` only shrinks |
| [nextjs-data/assets/tests/use-server-exports.test.ts](../../nextjs-data/assets/tests/use-server-exports.test.ts) | `<app-root>/tests/` | `action-use-server-exports`: non-async exports and re-exports from `"use server"` files, inline `"use server"` functions |
| [nextjs-app-structure/templates/locale-parity.test.ts](../../nextjs-app-structure/templates/locale-parity.test.ts) | `<app-root>/tests/` | `i18n-key-in-every-locale`: every key in every `src/messages/<locale>.json`, and every literal `t("key")` (with its `useTranslations`/`getTranslations` namespace) exists |
| [nextjs-app-structure/templates/src-layout.test.ts](../../nextjs-app-structure/templates/src-layout.test.ts) | `<app-root>/tests/` | `struct-src-folder-kinds`, `struct-no-top-level-twins` |

## Install

1. `yarn add -D eslint eslint-config-next vitest` (and `yarn add server-only`, which the marked modules import). Add scripts: `"lint": "eslint ."`, `"test": "vitest run"`.
2. Copy `eslint.config.mjs`, or merge its blocks into the existing config. One rule is configured once per file: keep each `no-restricted-imports`/`no-restricted-globals` list complete in the block that matches, as the file does.
3. Copy the tests into `<app-root>/tests/`. They are `.test.ts`, so they run in Vitest's `node` project without a DOM, and they read files from `<app-root>` (one folder up), so a monorepo copies them into each app.
4. Vitest can't load `server-only` outside Next (its default entry throws). Point it at an empty module in `vitest.config.*`: `resolve: { alias: [{ find: /^server-only$/, replacement: path.resolve(__dirname, "tests/server-only.stub.ts") }] }` with an empty `tests/server-only.stub.ts` (`export {};`).
5. Run them once on an existing app: each failure lists the file, line and fix. Fix what's cheap, put the rest in the test's allow-list or `EXEMPT` with a reason (the list only shrinks: a stale entry fails), or narrow the swept folders at the top of the test while an older part of the app moves over.

The tests read source text with regular expressions, not a parsed syntax tree: they catch the common shapes and say in their header what they miss (dynamic translation keys, a fetch hidden behind a hook or a prop). Review covers the rest.
