import { describe, it, expect, vi, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { PlaywrightTestConfig } from "@playwright/test";

// The Playwright config as CI loads it (CI=1, no E2E_PORT), and the CI files and CODEOWNERS
// around it. Rules (nextjs-e2e):
//   e2e-ci-production-build       every app web server runs a production build in CI; no CI file starts a dev server
//   e2e-health-route-ready        every web server waits on a url whose path is a route, not "/"; the app's port isn't 3000
//   e2e-flaky-is-failing          failOnFlakyTests is on in CI
//   e2e-freeze-motion             expect.toHaveScreenshot disables animations and hides the caret
//   e2e-keep-traces               trace and screenshot kept on failure (with retries, for an on-first-retry trace); the
//                                 CI file of the e2e job keeps playwright-report always and reports junit; blob reports are merged
//   e2e-image-matches-playwright  every mcr.microsoft.com/playwright image in CI is the installed @playwright/test version
//   e2e-review-baseline-updates   a CODEOWNERS line owns the screenshot baselines folder
// It misses: the CI checks read whole files, not jobs (a `when: always` on another job counts); whether the health
// route answers 200 only once the app is ready; whether code-owner approval is required (a project setting);
// fonts and data loaded before a screenshot. Place this file in <app-root>/tests/; root then resolves to the app.
const root = path.resolve(__dirname, "..");

// ADJUST: the config file, relative to root.
const CONFIG = "playwright.config.ts";
// ADJUST: how the app's own web server is told from helpers such as a fake backend (`node tests/e2e/fake-backend.mjs`).
const APP_SERVER = /\b(?:yarn|npm|pnpm|next)\b/;
// CI files, looked for in root and in the repository root (the nearest folder above that holds .git): files named
// like this, and the YAML files in these folders.
const CI_FILE_NAME = /(?:^|\.)gitlab-ci\.ya?ml$/;
const CI_DIRS = [".gitlab/ci", ".github/workflows"];
// Where CODEOWNERS may live, relative to the repository root and to root.
const CODEOWNERS = ["CODEOWNERS", ".gitlab/CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"];
// The folder the screenshot baselines live in (the asset's snapshotPathTemplate).
const BASELINES = "__screenshots__";
// Checks the project has decided not to meet yet: rule id -> reason. A waived check that passes fails, so the
// waiver goes once the work is done.
const WAIVED: Record<string, string> = {
  // "e2e-flaky-is-failing": "the suite still has two known flaky specs (issue link); on once they're fixed",
};

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "out", "build", "coverage", "test-results", "playwright-report"]);
const TRACE_KEPT = ["on-first-retry", "on-all-retries", "retain-on-failure", "retain-on-first-failure", "on"];
const SCREENSHOT_KEPT = ["only-on-failure", "on"];

vi.stubEnv("CI", "1");
vi.stubEnv("E2E_PORT", undefined);
vi.stubEnv("E2E_BASE_URL", undefined);
const config: PlaywrightTestConfig = (await import(path.join(root, CONFIG))).default;
afterAll(() => {
  vi.unstubAllEnvs();
});

const configText = fs.readFileSync(path.join(root, CONFIG), "utf8");
const configLines = configText.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l));
/** Index of the first config line (comments skipped) containing needle, or -1. */
const indexOf = (needle: string | RegExp) =>
  configLines.findIndex((l) => (typeof needle === "string" ? l.includes(needle) : needle.test(l)));
/** "<config>:<line>" of the first line containing needle (line 1 when not found). */
const inConfig = (needle: string | RegExp) => `${CONFIG}:${Math.max(indexOf(needle), 0) + 1}`;
/** The config lines of a web server's command (found by its text, else by its first two words) and of its url. */
function serverLines(s: { command: string }) {
  let cmd = indexOf(s.command);
  if (cmd < 0) cmd = indexOf(s.command.split(/\s+/).slice(0, 2).join(" "));
  const urls = configLines.flatMap((l, i) => (/\burl:/.test(l) ? [i] : []));
  const url = cmd < 0 || urls.length === 0 ? -1 : urls.reduce((a, b) => (Math.abs(b - cmd) < Math.abs(a - cmd) ? b : a));
  return { command: `${CONFIG}:${Math.max(cmd, 0) + 1}`, url: `${CONFIG}:${Math.max(url, 0) + 1}` };
}

const repoRoot = (() => {
  for (let dir = root; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    if (path.dirname(dir) === dir) return root;
  }
})();
const bases = [...new Set([root, repoRoot])];
const rel = (abs: string) => path.relative(root, abs).split(path.sep).join("/");

interface CiFile {
  file: string;
  lines: string[];
}
const ciFiles: CiFile[] = bases
  .flatMap((base) => [
    ...fs.readdirSync(base).filter((n) => CI_FILE_NAME.test(n)).map((n) => path.join(base, n)),
    ...CI_DIRS.map((d) => path.join(base, d))
      .filter((d) => fs.existsSync(d))
      .flatMap((d) => fs.readdirSync(d).filter((n) => /\.ya?ml$/.test(n)).map((n) => path.join(d, n))),
  ])
  .filter((f, i, all) => all.indexOf(f) === i)
  .map((f) => ({ file: rel(f), lines: fs.readFileSync(f, "utf8").split("\n").map((l) => (/^\s*#/.test(l) ? "" : l)) }));
const isE2eJobFile = (f: CiFile) => f.lines.some((l) => /mcr\.microsoft\.com\/playwright|playwright\s+test|test:e2e/.test(l));

const servers = [config.webServer ?? []].flat();
const appServers = servers.filter((s) => APP_SERVER.test(s.command));
const uses = [{ name: "the top-level use", use: config.use ?? {} }, ...(config.projects ?? []).map((p) => ({ name: `project "${p.name}"`, use: p.use ?? {} }))];
const modeOf = (v: unknown) => (typeof v === "object" && v !== null ? (v as { mode?: string }).mode : (v as string | undefined));

function check(rule: string, problems: string[], fix: string) {
  if (rule in WAIVED) {
    expect(problems.length, `${rule} passes now: remove it from WAIVED`).toBeGreaterThan(0);
    return;
  }
  const unique = [...new Set(problems)];
  expect(unique, `${fix} (rule ${rule}):\n${unique.join("\n")}`).toEqual([]);
}

describe("the Playwright config and CI around it (nextjs-e2e)", () => {
  it("runs a production build in CI (e2e-ci-production-build)", () => {
    const problems: string[] = [];
    if (appServers.length === 0) problems.push(`${inConfig("webServer")}: no web server runs the app (none matches ${APP_SERVER}); adjust APP_SERVER`);
    for (const s of appServers) {
      if (/\b(?:yarn|pnpm|next|npm\s+run)\s+dev\b/.test(s.command) || !/\bstart\b/.test(s.command))
        problems.push(`${serverLines(s).command}: in CI the app server runs "${s.command}"`);
    }
    for (const f of ciFiles)
      f.lines.forEach((l, i) => {
        if (/\b(?:yarn|pnpm|next|npm\s+run)\s+dev\b/.test(l)) problems.push(`${f.file}:${i + 1}: ${l.trim()}`);
      });
    check("e2e-ci-production-build", problems, "CI tests `yarn build && yarn start -p $PORT`; `yarn dev` only locally");
  });

  it("waits on a health route, on its own port (e2e-health-route-ready)", () => {
    const problems: string[] = [];
    for (const s of servers) {
      if (!s.url) {
        problems.push(`${serverLines(s).command}: "${s.command}" has no url; wait on a health route (url: ".../livez")`);
        continue;
      }
      const url = new URL(s.url);
      if (url.pathname === "/") problems.push(`${serverLines(s).url}: "${s.command}" waits on ${s.url}; "/" may 404 or redirect, use a health route`);
      if (appServers.includes(s) && (url.port || (url.protocol === "https:" ? "443" : "80")) === "3000")
        problems.push(`${inConfig("PORT")}: the app server listens on 3000; default E2E_PORT to another port (3100)`);
    }
    check("e2e-health-route-ready", problems, "webServer.url is a route answering 200, on a port other than 3000");
  });

  it("fails on flaky tests in CI (e2e-flaky-is-failing)", () => {
    const problems = config.failOnFlakyTests === true ? [] : [`${inConfig(/failOnFlakyTests|defineConfig\(/)}: failOnFlakyTests is ${String(config.failOnFlakyTests)} in CI`];
    check("e2e-flaky-is-failing", problems, "set failOnFlakyTests: CI, so a test that passes only on retry fails the job");
  });

  it("freezes motion for screenshots (e2e-freeze-motion)", () => {
    const shot = config.expect?.toHaveScreenshot ?? {};
    const problems: string[] = [];
    if (shot.animations !== "disabled") problems.push(`${inConfig(/toHaveScreenshot|expect:/)}: toHaveScreenshot.animations is ${String(shot.animations)}`);
    if (shot.caret !== "hide") problems.push(`${inConfig(/toHaveScreenshot|expect:/)}: toHaveScreenshot.caret is ${String(shot.caret)}`);
    check("e2e-freeze-motion", problems, 'set expect.toHaveScreenshot: { animations: "disabled", caret: "hide" }');
  });

  it("keeps traces, screenshots and reports (e2e-keep-traces)", () => {
    const problems: string[] = [];
    const top = config.use ?? {};
    for (const { name, use } of uses) {
      if (use !== top && !("trace" in use) && !("screenshot" in use)) continue;
      const trace = modeOf(use.trace ?? top.trace);
      const shot = modeOf(use.screenshot ?? top.screenshot);
      if (!TRACE_KEPT.includes(trace ?? "")) problems.push(`${inConfig(/trace:|use:/)}: ${name} has trace ${String(trace)}`);
      if (!SCREENSHOT_KEPT.includes(shot ?? "")) problems.push(`${inConfig(/screenshot:|use:/)}: ${name} has screenshot ${String(shot)}`);
      if (/retr/.test(trace ?? "") && !((config.retries ?? 0) > 0 || (config.projects ?? []).some((p) => (p.retries ?? 0) > 0)))
        problems.push(`${inConfig(/retries:|defineConfig\(/)}: trace "${trace}" records nothing with 0 retries in CI`);
    }
    const reporters = [config.reporter ?? []].flat().map((r) => (Array.isArray(r) ? r[0] : r));
    const e2eFiles = ciFiles.filter(isE2eJobFile);
    for (const f of e2eFiles) {
      for (const [re, what] of [
        [/when:\s*always/, "`when: always` on its artifacts"],
        [/playwright-report/, "playwright-report/ in the artifacts"],
        [/junit:/, "`reports: junit:`"],
      ] as const)
        if (!f.lines.some((l) => re.test(l))) problems.push(`${f.file}:1: the e2e job has no ${what}`);
    }
    if (reporters.includes("blob") && e2eFiles.length > 0 && !ciFiles.some((f) => f.lines.some((l) => /merge-reports/.test(l))))
      problems.push(`${inConfig("blob")}: CI writes blob reports but no CI file runs \`playwright merge-reports --reporter html,junit\``);
    check("e2e-keep-traces", problems, 'keep trace "on-first-retry", screenshot "only-on-failure", and the HTML and junit reports as artifacts');
  });

  it("runs CI in the image of the installed Playwright (e2e-image-matches-playwright)", () => {
    const installed: string = createRequire(path.join(root, "package.json"))("@playwright/test/package.json").version;
    const problems: string[] = [];
    for (const f of ciFiles)
      f.lines.forEach((l, i) => {
        for (const m of l.matchAll(/mcr\.microsoft\.com\/playwright:v([0-9][\w.]*?)(?:-[a-z]+)?(?=[\s"']|$)/g))
          if (m[1] !== installed) problems.push(`${f.file}:${i + 1}: image v${m[1]}, @playwright/test is ${installed}`);
      });
    check("e2e-image-matches-playwright", problems, "bump the image tag and @playwright/test together");
  });

  it("puts screenshot baselines under code owners (e2e-review-baseline-updates)", () => {
    const hasBaselines = (dir: string): boolean =>
      fs.readdirSync(dir, { withFileTypes: true }).some((e) => e.isDirectory() && !SKIP_DIRS.has(e.name) && (e.name === BASELINES || hasBaselines(path.join(dir, e.name))));
    const problems: string[] = [];
    if ((config.snapshotPathTemplate ?? "").includes(BASELINES) || hasBaselines(root)) {
      const owned = bases
        .flatMap((b) => CODEOWNERS.map((c) => path.join(b, c)))
        .filter((f) => fs.existsSync(f))
        .some((f) => fs.readFileSync(f, "utf8").split("\n").some((l) => !/^\s*#/.test(l) && l.includes(BASELINES) && /\s@\S/.test(l)));
      if (!owned) problems.push(`CODEOWNERS:1: no line owns ${BASELINES}/ (looked in ${CODEOWNERS.join(", ")})`);
    }
    check("e2e-review-baseline-updates", problems, `add \`/**/${BASELINES}/ @<team>\` to CODEOWNERS and require code-owner approval`);
  });

  it("has no stale waiver", () => {
    const known = ["e2e-ci-production-build", "e2e-health-route-ready", "e2e-flaky-is-failing", "e2e-freeze-motion", "e2e-keep-traces", "e2e-image-matches-playwright", "e2e-review-baseline-updates"];
    expect(Object.keys(WAIVED).filter((r) => !known.includes(r)), "WAIVED names a rule this test doesn't check").toEqual([]);
  });
});
