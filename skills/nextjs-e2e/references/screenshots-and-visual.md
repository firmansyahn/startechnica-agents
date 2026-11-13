# Screenshots and visual comparisons

Two different tools:

| | Screenshot script (`yarn shots`) | Visual comparison (`toHaveScreenshot`) |
|---|---|---|
| Purpose | A person (or agent) looks at the page after a change | CI fails when a page's pixels change |
| Output | PNGs in an artifacts folder, not committed | Baseline PNGs committed beside the specs |
| Runs | On demand, while working | In CI, on a fixed OS image |

Every visual change gets the script; visual comparisons are worth it for a few stable, high-value pages (the shell, a list, a form, the sign-in page), not every page.

## The screenshot script

`yarn shots <path> [<path> ...]` takes each page in light and dark (and each preset with `--presets`) with the backend mocked, and saves `artifacts/screenshots/<path>--<mode>[--<preset>].png`. The pieces are in `assets/`:

- [assets/shots.mjs](../assets/shots.mjs): parses the paths, starts Playwright on one spec with one worker, prints where the files went.
- [assets/screenshots.spec.ts](../assets/screenshots.spec.ts): for each path × mode × preset, sets the theme, mocks the reads, opens the page, waits for it to settle, saves a full-page screenshot.

Run it from the app root; it starts `yarn dev` on its own port unless one is already listening there.

## Setting the theme in a test

| Theme mechanism (`nextjs-ui`) | How the test sets it |
|---|---|
| A: next-themes, system mode | `test.use({ colorScheme: "dark" })` or `page.emulateMedia({ colorScheme: "dark" })` |
| A/B: next-themes, stored choice | `page.addInitScript(() => localStorage.setItem("theme", "dark"))` before `goto` (next-themes' default key is `theme`; use the project's `storageKey`) |
| B: preset/font on the session | Set them through the app's own action or the fake backend's user record before `goto` |
| C: server-painted cookie | `context.addCookies([{ name: "<appearance cookie>", value: "mode=dark;preset=ocean", url: baseURL }])` before `goto` |

Check the first paint, not just the settled page: assert the `<html>` class and `data-*` attributes right after `goto` (the no-flash rule, `ui-no-theme-flash`).

## Making screenshots stable

- **Fonts loaded:** `await page.evaluate(() => document.fonts.ready)`.
- **Network idle for the page's own data:** wait for a visible element that only renders with data (`getByRole("table")` with rows), not `networkidle`.
- **Animations and caret off:** `expect.toHaveScreenshot: { animations: "disabled", caret: "hide" }` in config.
- **Time fixed:** `page.clock.setFixedTime(...)` before `goto`, so dates, relative times and greetings don't drift.
- **Dynamic regions masked:** `mask: [page.getByTestId("live-sessions-count")]`, or hidden with a `stylePath` stylesheet (`[data-e2e-volatile] { visibility: hidden }`).
- **Viewport fixed** by the project's device; full-page shots for long pages.
- **One OS for baselines:** fonts and anti-aliasing differ between Linux, macOS and Windows. Generate and compare baselines in the same Docker image CI uses (`mcr.microsoft.com/playwright:v<version>-noble`), and update them there: `yarn playwright test --update-snapshots` inside the image, never from a laptop.
- **Thresholds small and explicit:** `maxDiffPixelRatio: 0.01` (or `maxDiffPixels`) per page; a page that needs a big threshold needs masking instead.

## Visual comparisons

```ts
test("items list", { tag: "@visual" }, async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-01-15T10:00:00Z"));
  await mockItems(page, [item({ name: "North" }), item({ name: "South" })]);
  await page.goto("/app/items");
  await expect(page.getByRole("row", { name: /North/ })).toBeVisible();
  await expect(page).toHaveScreenshot("items-list.png", { fullPage: true });
});
```

- Snapshot names are explicit; the path template puts them in a committed folder per project (`{testDir}/__screenshots__/{projectName}/{arg}{ext}`), so light and dark have separate baselines.
- A failing comparison's diff image is in the HTML report; look at it before updating the baseline. An update is part of the change's review.
