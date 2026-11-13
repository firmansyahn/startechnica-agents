# Playwright config for a Next.js app

The full file is [assets/playwright.config.ts](../assets/playwright.config.ts); this page explains the choices. Option names are checked against `@playwright/test` 1.64's types.

## Install

```bash
yarn add --dev @playwright/test
yarn playwright install --with-deps chromium     # CI uses the Playwright Docker image instead
```

`package.json` scripts: `"test:e2e": "playwright test"`, `"shots": "node scripts/shots.mjs"`. Keep `@playwright/test` and the CI image on the same version.

## Where specs live

`tests/e2e/**/*.spec.ts` (or `tests/<area>/*.spec.ts`), with `testMatch: "**/*.spec.ts"`. Vitest includes only `*.test.ts(x)`, so neither runner picks up the other's files. Shared fixtures in `tests/e2e/fixtures.ts`; sign-in state in `tests/e2e/.auth/` (gitignored).

## The web server

| | Command | Use |
|---|---|---|
| CI | `yarn build && yarn start -p $PORT` | What ships: production bundles, the real CSP and headers, no dev overlay, fast pages |
| Local | `yarn dev -p $PORT`, `reuseExistingServer: true` | Quick iteration against a server you already run |

- **Wait on a health route** (`/livez` answering 200). Playwright counts 2xx, 3xx and 400–403 as ready; a `404` on `/` (or a redirect loop) never is.
- **Own port per run** (`E2E_PORT`, default something other than 3000), so a run never reuses another checkout's dev server.
- **`timeout`** long enough for a cold build (`180_000` in CI).
- **Several servers:** `webServer` takes an array, e.g. a fake backend first, then Next pointed at it (`env: { BACKEND_URL: "http://127.0.0.1:4010" }`), see [auth-and-backend.md](auth-and-backend.md).
- **Environment:** pass what the server needs through `webServer.env`; never read real secrets in tests.

## Projects

```ts
projects: [
  { name: "setup", testMatch: /.*\.setup\.ts/ },
  { name: "chromium", use: { ...devices["Desktop Chrome"], storageState: "tests/e2e/.auth/admin.json" }, dependencies: ["setup"] },
  { name: "mobile", use: { ...devices["Pixel 7"], storageState: "tests/e2e/.auth/admin.json" }, dependencies: ["setup"], grep: /@mobile/ },
  { name: "dark", use: { ...devices["Desktop Chrome"], colorScheme: "dark", storageState: "tests/e2e/.auth/admin.json" }, dependencies: ["setup"], grep: /@visual|@a11y/ },
]
```

- **Chromium on every merge request**; Firefox and WebKit nightly or before a release, unless the product promises them on every change.
- **Mobile** runs the specs tagged `@mobile` (layout, navigation drawer, tables that scroll), not the whole suite.
- **Dark** runs the visual and accessibility specs. `colorScheme: "dark"` only drives `prefers-color-scheme`: it themes an app that follows the system (next-themes "system"); an app that stores the choice (cookie or `localStorage`) needs that set too (see [screenshots-and-visual.md](screenshots-and-visual.md)).
- Tag with `test("…", { tag: ["@mobile", "@visual"] }, …)` and select with `grep`/`--grep`.

## Run settings

- `fullyParallel: true`; `workers` from the runner's cores in CI (`"50%"`), 2–4 locally against `yarn dev`.
- `forbidOnly: !!process.env.CI`; `retries: process.env.CI ? 2 : 0`.
- `use.trace: "on-first-retry"` (or `"retain-on-failure"` while hunting a flake), `screenshot: "only-on-failure"`, `video: "retain-on-failure"` only if traces aren't enough.
- `reporter`: `[["list"], ["html", { open: "never" }]]` locally; add `["junit", { outputFile: "results/junit.xml" }]` for the CI test report, or `["blob"]` when sharding (merged afterwards).
- `expect.toHaveScreenshot` defaults (animations, caret, `maxDiffPixelRatio`, `stylePath`) set once in config.
- `outputDir: "test-results"`, snapshots via `snapshotPathTemplate` into a folder you commit.

## Commands

```bash
yarn playwright test                              # everything
yarn playwright test tests/e2e/items.spec.ts      # one file
yarn playwright test --project=chromium --grep @smoke
yarn playwright test --ui                         # watch mode with the time-travel UI
yarn playwright test --debug                      # step through with the inspector
yarn playwright show-report                       # last HTML report
yarn playwright show-trace test-results/<test>/trace.zip
yarn playwright codegen http://localhost:3100     # record locators, then rewrite them by role
```
