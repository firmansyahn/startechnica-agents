// Copy to <app-root>/playwright.config.ts and adjust the marked lines.
// Specs: tests/e2e/**/*.spec.ts. Sign-in setup: tests/e2e/*.setup.ts. Auth state: tests/e2e/.auth/ (gitignored).
import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;
// Its own port, so a run never reuses a dev server another checkout runs on 3000.
const PORT = process.env.E2E_PORT || "3100";
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
const admin = "tests/e2e/.auth/admin.json";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  outputDir: "test-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  // A test that passes only on a retry fails the run; the retry still records its trace.
  failOnFlakyTests: CI,
  workers: CI ? "50%" : 2,
  reporter: CI ? [["blob"], ["list"]] : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "en-US",
    timezoneId: "UTC",
  },

  expect: {
    toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.01 },
  },

  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"], storageState: admin }, dependencies: ["setup"] },
    { name: "mobile", use: { ...devices["Pixel 7"], storageState: admin }, dependencies: ["setup"], grep: /@mobile/ },
    { name: "dark", use: { ...devices["Desktop Chrome"], colorScheme: "dark", storageState: admin }, dependencies: ["setup"], grep: /@visual|@a11y/ },
  ],

  webServer: [
    // Optional: a fake backend the Next server calls (see references/auth-and-backend.md). Remove if unused.
    {
      command: "node tests/e2e/fake-backend.mjs",
      url: "http://127.0.0.1:4010/health",
      reuseExistingServer: !CI,
      timeout: 30_000,
    },
    {
      // CI tests the production build; locally, reuse `yarn dev` if it already runs on PORT.
      command: CI ? `yarn build && yarn start -p ${PORT}` : `yarn dev -p ${PORT}`,
      url: `http://localhost:${PORT}/livez`,      // a health route answering 200; adjust to the app's
      reuseExistingServer: !CI,
      timeout: CI ? 300_000 : 120_000,
      env: {
        BACKEND_URL: "http://127.0.0.1:4010",       // adjust: the variable the app's config reads
        E2E_AUTH: "1",                              // only if the app has a guarded test-only sign-in
      },
    },
  ],
});
