import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Enforces the src/ split: src/utils is pure, src/hooks holds the hooks, src/libs holds
// integration code, and no src/ folder has a top-level twin. A file in the wrong folder fails
// here with the move to make. Place this file in <app-root>/tests/ (<app>/tests/, apps/<app-name>/tests/,
// or tests/ when the repo is only the Next app); root then resolves to that app.
//
// Rules: struct-src-folder-kinds, struct-no-top-level-twins, struct-components-only-react (a .ts file
// or a use* hook under components/), struct-src-folder-readme (every src/<kind>/ has a README.md).
// What it can't see: a constant list or type declared inside a .tsx component file, and whether a
// README says anything useful.
const root = path.resolve(__dirname, "..");

// components/ files that aren't components but belong with them by convention (never stale-checked).
const COMPONENT_CONVENTIONS = [/-variants\.ts$/, /(^|\/)index\.ts$/]; // cva variants, barrels
// Other deliberate exceptions under components/, each with its reason. It only shrinks: an entry that
// matches no file fails the stale test.
const COMPONENTS_ALLOWED: Record<string, string> = {
  // "components/acme-ui/columns.ts": "column definitions the DataTable composite takes as its props type",
};

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
    const twins = ["constants", "hooks", "utils", "types", "services", "schemas", "providers", "stores", "libs", "lib"].filter((d) =>
      fs.existsSync(path.join(root, d)),
    );
    expect(twins, "these belong under src/").toEqual([]);
  });

  const notComponents = files("components")
    .map((f) => f.split(path.sep).join("/"))
    .filter((f) => !COMPONENT_CONVENTIONS.some((re) => re.test(f)))
    .filter((f) => /^use[A-Z-]/.test(path.basename(f)) || !f.endsWith(".tsx"));

  it("keeps components/ to React components", () => {
    const report = notComponents
      .filter((f) => !(f in COMPONENTS_ALLOWED))
      .map((f) => `${f}: ${/^use[A-Z-]/.test(path.basename(f)) ? "a hook: move it to src/hooks/" : "not a component: move it to its src/<kind>/ folder (or beside its one route)"}`);
    expect(report, `components/ holds React components only (rule struct-components-only-react):\n${report.join("\n")}`).toEqual([]);
  });

  it("has no stale components/ exception", () => {
    const stale = Object.keys(COMPONENTS_ALLOWED).filter((f) => !notComponents.includes(f));
    expect(stale, "these no longer need an exception: remove them from COMPONENTS_ALLOWED").toEqual([]);
  });

  it("has a README in every src folder", () => {
    const src = path.join(root, "src");
    const kinds = fs.existsSync(src) ? fs.readdirSync(src, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
    const missing = kinds.filter((k) => !fs.existsSync(path.join(src, k, "README.md"))).map((k) => `src/${k}/README.md`);
    expect(missing, `Add a short README (what goes in, how to import it) (rule struct-src-folder-readme):\n${missing.join("\n")}`).toEqual([]);
  });
});
