import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Enforces the src/ split: src/utils is pure, src/hooks holds the hooks, src/libs holds
// integration code, and no src/ folder has a top-level twin. A file in the wrong folder fails
// here with the move to make. Place this file in <app-root>/tests/ (<app>/tests/, apps/<app-name>/tests/,
// or tests/ when the repo is only the Next app); root then resolves to that app.
const root = path.resolve(__dirname, "..");

function files(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(rel);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });
}

const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

describe("src layout", () => {
  it("keeps hooks out of src/libs", () => {
    const stray = files("src/libs").filter((f) => /^use[A-Z]/.test(path.basename(f)));
    expect(stray, "move these to src/hooks").toEqual([]);
  });

  it("keeps src/utils pure", () => {
    const impure = files("src/utils").flatMap((f) => {
      const src = read(f);
      const why = [
        /from ["'](?:react|react-dom|next|next\/[\w/-]+|@tanstack\/[\w-]+)["']/.test(src) && "imports React, Next or TanStack",
        /from ["']@\/(?:libs|hooks|services|src\/api)\b/.test(src) && "imports integration code",
        /\b(?:window|document|localStorage|sessionStorage)\b/.test(src) && "touches the browser",
        /\bfetch\(|process\.env/.test(src) && "does I/O or reads the environment",
      ].filter(Boolean);
      return why.length ? [`${f}: ${why.join(", ")} (move it to src/libs or src/hooks)`] : [];
    });
    expect(impure).toEqual([]);
  });

  it("has no top-level twin of a src folder", () => {
    const twins = ["constants", "hooks", "utils", "types", "services", "schemas", "providers", "stores", "libs"].filter((d) =>
      fs.existsSync(path.join(root, d)),
    );
    expect(twins, "these belong under src/").toEqual([]);
  });
});
