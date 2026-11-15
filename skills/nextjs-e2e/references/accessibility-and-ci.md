# Accessibility checks and CI

## Axe scans

```bash
yarn add --dev @axe-core/playwright
```

```ts
import AxeBuilder from "@axe-core/playwright";

test("items page has no accessibility violations", { tag: "@a11y" }, async ({ page }) => {
  await page.goto("/app/items");
  await expect(page.getByRole("table")).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("[data-third-party-widget]")          // only what you can't fix, with a reason
    .analyze();
  expect(violations).toEqual([]);
});
```

- Scan each page the suite visits, after its data has loaded, and again with a dialog or drawer open; run the `@a11y` specs in light and dark (contrast differs).
- Put the scan in a fixture (`makeAxeBuilder`) so every spec uses the same tags and exclusions.
- Known violations on legacy pages: record them in a baseline file keyed by rule id and target, fail only on new ones, and shrink the baseline over time. Never disable a rule globally to get green.
- Axe finds about a third of real problems. Keyboard paths (Tab order, focus return after closing a dialog, Escape) are tested by hand-written specs: `await page.keyboard.press("Tab")` and `expect(locator).toBeFocused()`.

## Aria snapshots

`await expect(page.getByRole("navigation")).toMatchAriaSnapshot(...)` pins the accessible structure (roles, names, levels) of a region. Good for the app shell, menus and forms whose structure matters; cheaper and steadier than a screenshot for catching a lost label or heading level.

## CI job

```yaml
# .gitlab-ci.yml (shape; adapt to the org's CI templates)
e2e:
  image: mcr.microsoft.com/playwright:v1.64.1-noble     # same version as @playwright/test
  stage: test
  parallel: 4
  variables:
    E2E_PORT: "3100"
  script:
    - node .yarn/releases/yarn-*.cjs install --immutable
    - yarn build
    - yarn playwright test --shard=$CI_NODE_INDEX/$CI_NODE_TOTAL --reporter=blob
  artifacts:
    when: always
    paths: [blob-report/, test-results/]
    expire_in: 7 days

e2e-report:
  image: mcr.microsoft.com/playwright:v1.64.1-noble
  stage: report
  needs: [e2e]
  when: always
  variables:
    PLAYWRIGHT_JUNIT_OUTPUT_FILE: results/junit.xml
  script:
    - node .yarn/releases/yarn-*.cjs install --immutable
    - yarn playwright merge-reports --reporter html,junit ./blob-report   # each shard's blob file carries its shard number
  artifacts:
    when: always
    paths: [playwright-report/]
    reports:
      junit: results/junit.xml
```

- **The image version matches `@playwright/test`** exactly; a mismatch fails with missing browsers. Renovate can bump both together.
- **Build once** per shard (or build in an earlier job and pass `.next/` as an artifact) and `yarn start` it; never test `yarn dev` in CI.
- **Shard** when the suite passes about 10 minutes; `fullyParallel` must already pass so shards are balanced.
- **Keep evidence:** `trace: "on-first-retry"`, `screenshot: "only-on-failure"`, the merged HTML report and the junit report for the merge request widget.
- **Smoke on every merge request, full suite on the main branch and nightly**, when the full suite is slow: tag a small `@smoke` set.

## Flaky tests

- Retries in CI make a flaky test pass and show as "flaky" in the report; treat that as a failing test with a ticket, not as green. The asset config sets `failOnFlakyTests: CI`, so a test that passes only on retry fails the CI run; while an older suite is being cleaned up, mark the known flaky tests `test.fixme()` with an issue link rather than turning it off.
- Reproduce with `--repeat-each=20 --workers=4` and read the trace of the failing run.
- Usual causes, in order: a fixed wait or a non-retrying assertion; shared data between tests; a race with a background refetch (assert on the final state, not an intermediate one); time and animation; a third-party request.
- Quarantine with `test.fixme()` and an issue link only while fixing it; never delete the assertion that fails.
