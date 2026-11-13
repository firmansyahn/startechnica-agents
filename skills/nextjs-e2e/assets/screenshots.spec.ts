// Copy to <app-root>/tests/e2e/screenshots.spec.ts. Driven by scripts/shots.mjs (`yarn shots <path>`);
// skipped in normal runs. Adjust the three marked helpers to the app: how the theme is set, which
// presets exist, and how reads are mocked.
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const paths = (process.env.SHOT_PATHS ?? "").split(",").filter(Boolean);
const withPresets = process.env.SHOT_PRESETS === "1";
const modes = ["light", "dark"] as const;
// ADJUST: the preset names the app ships (the same list its CSS and validators use).
const presets = withPresets ? ["default", "ocean", "forest"] : ["default"];
const outDir = path.resolve(__dirname, "..", "..", "artifacts", "screenshots");

// The screenshot script signs in through the fake backend or the mocks below, not the setup project.
test.use({ storageState: { cookies: [], origins: [] } });
test.skip(paths.length === 0, "run through `yarn shots <path>`");

// ADJUST: set the theme the way the app stores it (references/screenshots-and-visual.md).
async function setTheme(page: Page, mode: (typeof modes)[number], preset: string) {
  await page.emulateMedia({ colorScheme: mode });
  await page.addInitScript(([m]) => localStorage.setItem("theme", m), [mode]);
  await page.context().addCookies([{ name: "appearance", value: `mode=${mode};preset=${preset}`, url: test.info().project.use.baseURL! }]);
}

// ADJUST: answer the reads the pages make, with fixtures that fit the API spec.
async function mockReads(page: Page) {
  await page.route("**/api/**", (route) => route.fulfill({ json: { status: 200, data: [], total: 0 } }));
}

for (const p of paths) {
  for (const mode of modes) {
    for (const preset of presets) {
      const name = `${p.replace(/^\//, "").replace(/\//g, "_")}--${mode}${preset === "default" ? "" : `--${preset}`}.png`;
      test(name, async ({ page }) => {
        await page.clock.setFixedTime(new Date("2026-01-15T10:00:00Z"));
        await setTheme(page, mode, preset);
        await mockReads(page);
        await page.goto(p);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: path.join(outDir, name), fullPage: true, animations: "disabled", caret: "hide" });
      });
    }
  }
}
