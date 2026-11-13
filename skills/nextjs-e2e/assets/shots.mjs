#!/usr/bin/env node
// Copy to <app-root>/scripts/shots.mjs and add "shots": "node scripts/shots.mjs" to package.json.
//
//   yarn shots app/items app/settings/profile           light + dark
//   yarn shots --presets app/items                       light + dark for every theme preset
//
// Takes screenshots of the named pages with the backend mocked (tests/e2e/screenshots.spec.ts) and
// saves them to artifacts/screenshots/. Starts `yarn dev` on E2E_PORT (3100 by default) unless a
// server already listens there.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const presets = args.includes("--presets");
// Git Bash on Windows rewrites a leading-slash argument into a path under its install folder
// (/app/x -> C:/Program Files/Git/app/x); undo that, and accept app/x without the slash.
const paths = args
  .filter((a) => !a.startsWith("-"))
  .map((a) => a.replace(/\\/g, "/").replace(/^[A-Za-z]:\/.*?\/Git(?=\/)/i, ""))
  .map((a) => (a.startsWith("/") ? a : `/${a}`));

if (paths.length === 0) {
  console.error("usage: yarn shots [--presets] <path> [<path> ...]");
  process.exit(1);
}

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {
  ...process.env,
  SHOT_PATHS: paths.join(","),
  SHOT_PRESETS: presets ? "1" : "",
  E2E_PORT: process.env.E2E_PORT || "3100",
};
const run = spawnSync(
  "yarn",
  ["playwright", "test", "tests/e2e/screenshots.spec.ts", "--project=chromium", "--workers=1", "--no-deps"],
  { cwd: appRoot, env, stdio: "inherit", shell: process.platform === "win32" },
);
if (run.status === 0) console.log(`\nScreenshots: ${path.resolve(appRoot, "artifacts", "screenshots")}`);
process.exit(run.status ?? 1);
