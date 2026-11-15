import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Every page has a page test, and each page test renders in a second locale and runs the
// accessibility check (`nextjs-app-structure` Testing rules). Place this file in <app-root>/tests/;
// root then resolves to the app.
//
// - page-test-every-page: every app/**/page.tsx has a page.test.tsx beside it, except EXEMPT.
// - page-test-second-locale: each page.test.tsx renders once through the test wrapper with a locale
//   other than REFERENCE_LOCALE and that locale's messages (the kit's renderWithQuery takes
//   `{ locale, msgs }`; a second locale with the reference messages proves nothing). It runs once
//   MESSAGES_DIR holds a second locale file.
// - ui-heading-hierarchy (`nextjs-ui`): each page.test.tsx calls A11Y_CALL, the axe helper from
//   `nextjs-ui` assets/tests/axe.ts, which runs heading-order and page-has-heading-one.
//
// What it can't see: whether the test covers the read call, a write's body, a validation error and
// the read-only user (review), and whether the second-locale render asserts anything.
const root = path.resolve(__dirname, "..");

const MESSAGES_DIR = "src/messages"; // the second-locale check runs once a second <locale>.json exists here
const REFERENCE_LOCALE = "en";
const LOCALE_OPTION = "locale"; // the wrapper's option names: renderWithQuery(ui, { locale, msgs })
const MESSAGES_OPTION = "msgs";
const A11Y_CALL: string | null = "expectAccessible"; // null turns the accessibility check off
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", "coverage"]);
// Pages without a page test, each with its reason (a redirect, a static page). Both lists only shrink:
// an entry whose page is gone or now passes fails the stale tests.
const EXEMPT: Record<string, string> = {
  // "app/page.tsx": "redirects to /dashboard; nothing renders",
};
// Page tests that don't need the second-locale render, each with its reason.
const ONE_LOCALE: Record<string, string> = {
  // "app/(public)/legal/page.test.tsx": "the legal text is published in one language only",
};

function walk(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) || entry.name.startsWith("_") ? [] : walk(rel); // _private: never routed
    return [rel];
  });
}

const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whether a test renders with a second locale and its messages: an options object with both. */
function rendersSecondLocale(src: string): boolean {
  const locale = new RegExp(String.raw`\b${escape(LOCALE_OPTION)}\s*:\s*["'\`]([\w-]+)["'\`]`);
  const msgs = new RegExp(String.raw`\b${escape(MESSAGES_OPTION)}\b\s*[:,}]`);
  return [...src.matchAll(/\{[^{}]*\}/g)].some(([obj]) => {
    const m = obj.match(locale);
    return !!m && m[1] !== REFERENCE_LOCALE && msgs.test(obj);
  });
}

const callsA11y = (src: string) => !!A11Y_CALL && new RegExp(String.raw`(?<![\w$.])${escape(A11Y_CALL)}\s*\(`).test(src);

describe("page tests (`nextjs-app-structure` Testing rules)", () => {
  it("recognises a second-locale render", () => {
    expect(rendersSecondLocale(`renderWithQuery(<ItemsClient />, { locale: "de", msgs: de });`)).toBe(true);
    expect(rendersSecondLocale(`const msgs = de; renderWithQuery(<ItemsClient />, { msgs, locale: 'fr' });`)).toBe(true);
    expect(rendersSecondLocale(`renderWithQuery(<ItemsClient />, { locale: "de" });`)).toBe(false);
    expect(rendersSecondLocale(`renderWithQuery(<ItemsClient />, { locale: "${REFERENCE_LOCALE}", msgs: en });`)).toBe(false);
    expect(callsA11y(`await expectAccessible();`)).toBe(!!A11Y_CALL);
  });

  const files = walk("app");
  const pages = files.filter((f) => /\/page\.[jt]sx?$/.test(f));
  const tests = files.filter((f) => f.endsWith("/page.test.tsx"));
  const untested = pages.filter((p) => !files.includes(`${path.posix.dirname(p)}/page.test.tsx`));

  it("has a page.test.tsx beside every page", () => {
    const report = untested.filter((p) => !(p in EXEMPT)).map((p) => `${p}: add ${path.posix.dirname(p)}/page.test.tsx`);
    expect(report, `Every page has a page test (rule page-test-every-page), or an EXEMPT entry with its reason:\n${report.join("\n")}`).toEqual([]);
  });

  const messagesDir = path.join(root, MESSAGES_DIR);
  const locales = fs.existsSync(messagesDir) ? fs.readdirSync(messagesDir).filter((f) => f.endsWith(".json")) : [];

  it.runIf(locales.length > 1)("renders every page test in a second locale", () => {
    const report = tests
      .filter((t) => !(t in ONE_LOCALE) && !rendersSecondLocale(read(t)))
      .map((t) => `${t}: add a render with { ${LOCALE_OPTION}: "<second locale>", ${MESSAGES_OPTION}: <its messages> }`);
    expect(report, `A second locale renders (rule page-test-second-locale):\n${report.join("\n")}`).toEqual([]);
  });

  it.runIf(!!A11Y_CALL)("runs the accessibility check in every page test", () => {
    const report = tests.filter((t) => !callsA11y(read(t))).map((t) => `${t}: call ${A11Y_CALL}() after the page has loaded`);
    expect(report, `Headings and labels are checked by axe (rule ui-heading-hierarchy, nextjs-ui assets/tests/axe.ts):\n${report.join("\n")}`).toEqual([]);
  });

  it("has no stale exemption", () => {
    const stale = [
      ...Object.keys(EXEMPT).filter((p) => !untested.includes(p)).map((p) => `EXEMPT ${p}`),
      ...Object.keys(ONE_LOCALE).filter((t) => !tests.includes(t) || rendersSecondLocale(read(t))).map((t) => `ONE_LOCALE ${t}`),
    ];
    expect(stale, `these are gone or pass now: remove them:\n${stale.join("\n")}`).toEqual([]);
  });
});
