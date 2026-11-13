---
name: nextjs-e2e
description: "Use when writing, running, debugging or reviewing browser tests for a Next.js App Router app with Playwright: playwright.config (testMatch, webServer with a production build or dev, baseURL, ports, projects for desktop, mobile and dark mode), signing in once with storageState through a BFF session cookie or a test-only sign-in, mocking the backend (page.route for browser calls versus a fake backend the Next server calls, since server-side BFF and server-action fetches never reach page.route), screenshot scripts for light/dark/theme presets, visual comparisons (toHaveScreenshot) and flakiness, accessibility checks with @axe-core/playwright and aria snapshots, role-based locators, test data isolation, CI (sharding, blob reports, traces, artifacts, the Playwright Docker image), and deciding what belongs in Vitest instead."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# End-to-end tests with Playwright

Playwright tests the app as a user meets it: the real Next server, real routing, `proxy.ts`, the BFF, server actions, the CSP and the theme script, in a real browser. They are slow and costly, so they cover what only a browser can show; everything else is a Vitest test beside the code (`nextjs-app-structure`, `nextjs-data`).

| Test it in | When |
|---|---|
| **Vitest** (`*.test.ts(x)`) | Component and page behaviour with the network faked at `fetch`, query and action logic, validation, the read-only user, translations, pure functions |
| **Playwright** (`*.spec.ts`) | Journeys across pages (sign in → create → see it in the list), `proxy.ts` gating and redirects, the BFF and session cookie, server actions end to end, headers and CSP, first paint of the theme, layout at phone width, accessibility scans, screenshots |

Related: `nextjs-app-structure` (where specs live: `tests/e2e/` or `tests/<area>/`), `nextjs-bff` (the cookie and proxy under test), `nextjs-ui` (themes, presets, the no-flash rule), `nextjs-security` (header and CSP checks), `nextjs-package-manager` (every command through Yarn). Check the installed Playwright version (`node_modules/@playwright/test/package.json`) and its types before using an option you're unsure of.

## Read the reference for the task

| Task | Reference |
|---|---|
| Set up or change `playwright.config.ts`: web server, ports, projects, reporters, retries | [references/config.md](references/config.md) + [assets/playwright.config.ts](assets/playwright.config.ts) |
| Sign in once and reuse it; mock or fake the backend; seed and isolate data | [references/auth-and-backend.md](references/auth-and-backend.md) |
| Screenshot pages in light/dark/presets, compare screenshots, keep them stable | [references/screenshots-and-visual.md](references/screenshots-and-visual.md) + [assets/shots.mjs](assets/shots.mjs), [assets/screenshots.spec.ts](assets/screenshots.spec.ts) |
| Accessibility scans, aria snapshots, CI jobs, sharding, traces, flaky tests | [references/accessibility-and-ci.md](references/accessibility-and-ci.md) |

## Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### Locators

| ID | Rule | Impact | Check |
|---|---|---|---|
| [test-e2e-role-locators](rules/test-e2e-role-locators.md) | Locate elements by role and accessible name in end-to-end tests, not by CSS or XPath | LOW | scan |
| [e2e-labels-and-text-locators](rules/e2e-labels-and-text-locators.md) | Labels for fields, text for static content, test ids last | LOW | review |
| [e2e-scope-locators](rules/e2e-scope-locators.md) | Scope locators to a region before picking inside it | LOW | review |
| [e2e-web-first-assertions](rules/e2e-web-first-assertions.md) | Assert with web-first expect, not with values read out | LOW | review |
| [e2e-assert-what-users-see](rules/e2e-assert-what-users-see.md) | Assert on what the user sees, not on implementation | LOW | review |
| [e2e-one-locator-one-element](rules/e2e-one-locator-one-element.md) | One locator, one element | LOW | review |

### Stability

| ID | Rule | Impact | Check |
|---|---|---|---|
| [test-e2e-no-fixed-waits](rules/test-e2e-no-fixed-waits.md) | Wait for conditions in end-to-end tests, never for a fixed time or network idle | LOW | scan |
| [e2e-fixed-clock](rules/e2e-fixed-clock.md) | Fix the clock where time shows | LOW | review |
| [e2e-assert-url-after-navigation](rules/e2e-assert-url-after-navigation.md) | Wait for navigation by asserting the URL | LOW | review |
| [e2e-assert-final-state](rules/e2e-assert-final-state.md) | Assert the final state, not an intermediate one | LOW | review |
| [e2e-independent-tests](rules/e2e-independent-tests.md) | Tests don't depend on order or on each other | LOW | review |
| [e2e-flaky-is-failing](rules/e2e-flaky-is-failing.md) | A flaky test is a failing test | LOW | review |

### Data and auth

| ID | Rule | Impact | Check |
|---|---|---|---|
| [e2e-sign-in-once-per-role](rules/e2e-sign-in-once-per-role.md) | Sign in once per role, in a setup project | MEDIUM | review |
| [e2e-test-sign-in-not-in-prod](rules/e2e-test-sign-in-not-in-prod.md) | Test-only sign-in can't be enabled in production | MEDIUM | review |
| [e2e-mock-where-requested](rules/e2e-mock-where-requested.md) | Mock where the request is made | MEDIUM | review |
| [e2e-mocks-fit-spec](rules/e2e-mocks-fit-spec.md) | Mocked answers fit the API spec | MEDIUM | review |
| [e2e-own-test-data](rules/e2e-own-test-data.md) | Each test creates its own data, with a unique name | MEDIUM | review |
| [e2e-isolate-workers](rules/e2e-isolate-workers.md) | Shared backends are isolated per worker | MEDIUM | review |
| [e2e-no-real-data](rules/e2e-no-real-data.md) | No real secrets or personal data in fixtures | MEDIUM | review |

### Visual

| ID | Rule | Impact | Check |
|---|---|---|---|
| [e2e-look-light-and-dark](rules/e2e-look-light-and-dark.md) | Every visual change is looked at in light and dark | LOW | review |
| [e2e-set-theme-like-app](rules/e2e-set-theme-like-app.md) | Set the theme the way the app stores it | LOW | review |
| [e2e-check-first-paint](rules/e2e-check-first-paint.md) | Check the first paint, not only the settled page | LOW | review |
| [e2e-freeze-motion](rules/e2e-freeze-motion.md) | Freeze what moves before a screenshot | LOW | review |
| [e2e-mask-dynamic-regions](rules/e2e-mask-dynamic-regions.md) | Mask dynamic regions instead of raising thresholds | LOW | review |
| [e2e-baselines-from-ci](rules/e2e-baselines-from-ci.md) | Baselines come from the CI image | LOW | review |
| [e2e-review-baseline-updates](rules/e2e-review-baseline-updates.md) | A baseline update is reviewed like code | LOW | review |
| [e2e-few-visual-baselines](rules/e2e-few-visual-baselines.md) | Compare a few key pages, not all of them | LOW | review |

### Scope and CI

| ID | Rule | Impact | Check |
|---|---|---|---|
| [e2e-browser-only-scope](rules/e2e-browser-only-scope.md) | E2E covers what only a browser can show | MEDIUM | review |
| [e2e-spec-suffix](rules/e2e-spec-suffix.md) | Specs are .spec.ts, unit tests .test.ts(x) | MEDIUM | review |
| [e2e-ci-production-build](rules/e2e-ci-production-build.md) | CI tests a production build | MEDIUM | review |
| [e2e-health-route-ready](rules/e2e-health-route-ready.md) | The server is ready on a health route, on its own port | MEDIUM | review |
| [e2e-axe-every-page](rules/e2e-axe-every-page.md) | Every visited page gets an accessibility scan | MEDIUM | review |
| [e2e-keyboard-paths](rules/e2e-keyboard-paths.md) | Keyboard paths are tested explicitly | MEDIUM | review |
| [e2e-check-headers-csp](rules/e2e-check-headers-csp.md) | Headers and CSP are checked on a real page | MEDIUM | review |
| [e2e-keep-traces](rules/e2e-keep-traces.md) | CI keeps traces and reports | MEDIUM | review |
| [e2e-image-matches-playwright](rules/e2e-image-matches-playwright.md) | The browser image matches the Playwright version | MEDIUM | review |

## Rules that hold everywhere

1. **Specs are `*.spec.ts`**, never matched by Vitest; Vitest files are `*.test.ts(x)`, never matched by Playwright.
2. **CI tests a production build** (`yarn build` then `yarn start`); local runs may reuse `yarn dev`. The server is ready on a health route, on its own port.
3. **Sign in once per role** in a setup project and reuse `storageState`; never click through sign-in in every test.
4. **Mock where the request is made**: `page.route` sees only browser requests; the Next server's own calls (BFF, server actions, Server Components) need a fake backend it is pointed at.
5. **Locate by role and name**, assert with web-first `expect` that retries; no `waitForTimeout`, no CSS-class selectors.
6. **Each test owns its data** (created with a unique name, or isolated per worker); tests run in any order and in parallel.
7. **Screenshots are deterministic**: fixed clock, fonts loaded, animations off, dynamic regions masked, one OS image for baselines.
8. **Accessibility is scanned** on every page the suite visits, in light and dark.
9. **CI keeps the evidence**: traces and screenshots on failure, the HTML report as an artifact; retries report flaky tests, they don't hide them.

## Reviewing

1. **Scope.** The diff (`git diff <base>...HEAD`), a merge request's files or the whole app, read for what this skill covers: Playwright specs, fixtures and config.
2. **Scan.** `bash <this skill>/scripts/scan.sh <app-root>` lists candidates for the rules whose check includes `scan`. On a diff, keep only findings in changed lines or files. Every line is a candidate: open the rule and confirm it before reporting.
3. **Read** the changed code against the Rules above. Open each rule you cite and match its "Incorrect" shape, not just its title.
4. **Report** each finding in the format of `agent-skills-authoring` ("Scan scripts and findings"): impact, rule ID, file and line, what to change citing the rule's "Correct" shape; ordered by impact. Raise the impact one level on an authentication, payment or deletion path.
5. **Say what's not covered:** rules whose check is `test` or `eslint` but the project has no such test or lint rule. `kit` in the Check column means a ready-to-copy check exists (`nextjs-new-app`, references/enforcement-kit.md).

## Checklist

- [ ] `playwright.config.ts` from the asset: `testMatch: "**/*.spec.ts"`, web server on a health URL and its own port, `forbidOnly` and retries in CI
- [ ] Setup project signs in per role; specs use `storageState`
- [ ] Backend faked at the right layer (browser routes vs fake backend server), answers fit the API spec
- [ ] Role-based locators and web-first assertions only; no fixed waits
- [ ] Data unique per test; no order dependence; `fullyParallel` passes
- [ ] Screenshots: light and dark (and presets when tokens change), stable settings, baselines from the CI image
- [ ] Axe scan on each visited page with no new violations
- [ ] CI: production build, browsers from the matching Docker image or `yarn playwright install --with-deps`, sharded when slow, traces and report kept
