import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Where tests go and which suffix they take (`nextjs-app-structure` Testing rules). Place this file
// in <app-root>/tests/; root then resolves to the app.
//
// - page-test-beside-code: no `__tests__/` folder anywhere, and no test in tests/ that imports the
//   app's code (a unit or page test: it belongs beside the file it tests). Rule tests like this one
//   read the tree with node:fs and import nothing from the app, so they stay in tests/.
// - page-test-suffix-environment: a `.test.ts` runs without a DOM, so one that imports Testing
//   Library, renders, or reads `window`/`document` must be `.test.tsx`; no Vitest test imports
//   `@playwright/test` for its values (that is a `.spec.ts`; a type-only import is fine).
//
// What it can't see: a `.test.tsx` that never touches the DOM (it only costs time), DOM use hidden in
// a helper the test calls, and a test beside the wrong file.
const root = path.resolve(__dirname, "..");

const TESTS_DIR = "tests";
const E2E_DIRS = ["tests/e2e"]; // Playwright specs: not checked for placement
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", "coverage", "playwright-report", "test-results", ".git", ".yarn"]);
// Imports that point into the app: the aliases (tsconfig paths) and relative paths out of tests/.
const APP_IMPORT = /^(?:@\/|~\/|\.\.\/)/;
// Tests in tests/ that may import app code, each with its reason. It only shrinks: an entry that no
// longer imports app code (or no longer exists) fails the stale test.
const ALLOWED_IN_TESTS: Record<string, string> = {
  // "tests/routes.test.ts": "checks the route -> permission map against app/ (a rule test that needs the map)",
};

const DOM_USE: [RegExp, string][] = [
  [/(?<![\w$.])render(?:Hook)?\s*\(/, "renders"],
  [/(?<![\w$.])render[A-Z]\w*\s*\(/, "renders through a wrapper"],
  [/(?<![\w$.])screen\./, "queries screen"],
  [/(?<![\w$.])(?:window|document)\s*\.|(?<![\w$.])(?:globalThis\.)?(?:localStorage|sessionStorage)\s*\./, "touches window or document"],
];

function walk(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : [`${rel}/`, ...walk(rel)];
    return [rel];
  });
}

const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

/**
 * The source with comments, strings, templates and regex literals blanked, so a sample or a pattern
 * isn't read as code. A `/` starts a regex where an expression is expected (after `(,=:[!&|?{};` or `return`).
 */
function code(src: string): string {
  let out = "";
  let i = 0;
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  while (i < src.length) {
    const c = src[i];
    let end = i;
    if (c === "/" && src[i + 1] === "/") end = src.indexOf("\n", i) === -1 ? src.length : src.indexOf("\n", i);
    else if (c === "/" && src[i + 1] === "*") end = src.indexOf("*/", i + 2) === -1 ? src.length : src.indexOf("*/", i + 2) + 2;
    else if (c === '"' || c === "'" || c === "`" || (c === "/" && /(?:^|[(,=:[!&|?{};]|\breturn)\s*$/.test(out.slice(-20)))) {
      let inClass = false;
      for (end = i + 1; end < src.length; end++) {
        if (src[end] === "\\") end++;
        else if (c === "/" && src[end] === "[") inClass = true;
        else if (c === "/" && src[end] === "]") inClass = false;
        else if (src[end] === c && !inClass) break;
        else if (c !== "`" && src[end] === "\n") break;
      }
      end++;
    }
    if (end > i) {
      out += blank(src.slice(i, end));
      i = end;
    } else out += src[i++];
  }
  return out;
}

/** The modules a source imports at the top level: `import ... from "x"`, `import "x"`, `export ... from "x"`. */
function imports(src: string): string[] {
  const found: string[] = [];
  for (const m of src.matchAll(/^\s*(?:import\s*["']([^"']+)["']|(?:import|export)\b[^;"'`]*?\bfrom\s*["']([^"']+)["'])/gm)) found.push(m[1] ?? m[2]);
  return found;
}
/** The modules imported for their values: `import type { X } from "m"` loads nothing at run time. */
const valueImports = (src: string) =>
  imports(src.replace(/^\s*(?:import|export)\s+type\b[^;"'`]*?\bfrom\s*["'][^"']+["'];?/gm, ""));

/** Why a `.test.ts` source needs a DOM, or nothing. */
function needsDom(src: string): string[] {
  const why = imports(src).some((m) => m.startsWith("@testing-library/")) ? ["imports Testing Library"] : [];
  const body = code(src);
  for (const [re, reason] of DOM_USE) if (re.test(body)) why.push(reason);
  return why;
}

describe("tests sit beside their code with the right suffix (`nextjs-app-structure` Testing rules)", () => {
  it("reads imports and DOM use, not samples in strings or comments", () => {
    const sample = [`import { render, screen } from "@testing-library/react";`, `import { it } from "vitest";`, `export { x } from "../src/x";`].join("\n");
    expect(imports(sample)).toEqual(["@testing-library/react", "vitest", "../src/x"]);
    expect(needsDom(`it("a", () => { render(<A />); screen.getByRole("button"); });`)).toEqual(["renders", "queries screen"]);
    expect(needsDom(`it("b", () => { renderWithQuery(<A />); expect(window.location.href).toBe("x"); });`)).toEqual(["renders through a wrapper", "touches window or document"]);
    expect(needsDom(`// render(<A />) and window.x in a comment\nconst s = "screen.getByRole('x') document.body"; const r = /window\\./; t.render(x);`)).toEqual([]);
  });

  const all = walk("");
  const tests = all.filter((f) => /\.test\.tsx?$/.test(f));

  it("has no __tests__ folder", () => {
    const folders = all.filter((f) => f.endsWith("/__tests__/") || f === "__tests__/");
    expect(folders, `Move each test beside the file it tests (rule page-test-beside-code):\n${folders.join("\n")}`).toEqual([]);
  });

  const inTests = tests.filter((f) => f.startsWith(`${TESTS_DIR}/`) && !E2E_DIRS.some((d) => f.startsWith(`${d}/`)));
  const importsApp = inTests.filter((f) => imports(read(f)).some((m) => APP_IMPORT.test(m)));

  it("keeps tests of app code out of tests/", () => {
    const report = importsApp
      .filter((f) => !(f in ALLOWED_IN_TESTS))
      .map((f) => `${f}: imports ${imports(read(f)).filter((m) => APP_IMPORT.test(m)).join(", ")} -> move it beside that file`);
    expect(report, `tests/ holds the harness, repo-wide rule tests and e2e specs only (rule page-test-beside-code):\n${report.join("\n")}`).toEqual([]);
  });

  it("has no stale tests/ exception", () => {
    const stale = Object.keys(ALLOWED_IN_TESTS).filter((f) => !importsApp.includes(f));
    expect(stale, "these no longer import app code (or are gone): remove them from ALLOWED_IN_TESTS").toEqual([]);
  });

  it("names DOM tests .test.tsx and keeps Playwright out of Vitest", () => {
    const report = tests.flatMap((f) => {
      const src = read(f);
      const out: string[] = [];
      if (valueImports(src).includes("@playwright/test")) out.push(`${f}: imports @playwright/test -> rename it to .spec.ts (Playwright, not Vitest)`);
      if (f.endsWith(".test.ts")) {
        const why = needsDom(src);
        if (why.length) out.push(`${f}: ${why.join(", ")} -> rename it to .test.tsx (the dom project)`);
      }
      return out;
    });
    expect(report, `The suffix picks the environment (rule page-test-suffix-environment):\n${report.join("\n")}`).toEqual([]);
  });
});
