import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rule ui-theme-tokens-only: color only with semantic tokens. A literal palette, white/black,
// hex or color-function class looks right in the mode and preset its author used and wrong in the
// others. Place this file in <app-root>/tests/; root then resolves to the app.
const root = path.resolve(__dirname, "..");

// Folders swept, relative to root. Narrow it (e.g. ["app/admin", "components"]) while an older
// part of the app is still being moved onto tokens, and widen it as each part is done.
const DIRS = ["app", "components", "src"];
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", "coverage"]);

// Deliberate exceptions: the file (exact path or pattern), the classes allowed there, and why.
// Every entry must still match something (the last test fails on a stale one), so the list shrinks.
interface Allowed {
  file: string | RegExp;
  pattern: RegExp;
  reason: string;
}
const ALLOWED: Allowed[] = [
  {
    file: /^components\/shadcn-ui\//,
    pattern: /^(?:[\w-]+:)*bg-black(?:\/\d+)?$/,
    reason: "the overlay scrim behind dialogs and sheets is black in every mode (shadcn's own class)",
  },
  // { file: "app/print/receipt/ReceiptPreview.tsx", pattern: /^bg-white$/, reason: "a printed page is white paper in every mode" },
];

const PALETTE =
  /(?<![\w-])(?:[\w-]+(?:-?\[[^\]\s]*\])?:)*(?:text|bg|border(?:-[xytrblse])?|ring(?:-offset)?|inset-ring|inset-shadow|drop-shadow|text-shadow|divide|from|via|to|shadow|fill|stroke|outline|placeholder|decoration|caret|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d+)?(?![\w-])/g;
const HEX = /(?<![\w-])(?:[\w-]+(?:-?\[[^\]\s]*\])?:)*[a-z]+(?:-[a-z]+)*-\[(?:color:)?#[0-9a-fA-F]{3,8}\](?:\/\d+)?/g;
const COLOR_FN = /(?<![\w-])(?:[\w-]+(?:-?\[[^\]\s]*\])?:)*[a-z]+(?:-[a-z]+)*-\[(?:color:)?(?:rgba?|hsla?|oklch|oklab)\(/g;

const SUGGESTIONS: [RegExp, string][] = [
  [/-\[#|-\[(?:color:)?(?:rgb|hsl|okl)/, "a surface token: bg-background, bg-card, bg-popover, bg-muted; borders border-border"],
  [/^(?:.*:)?(?:border|divide|ring|outline)/, "border-border, border-input or ring-ring"],
  [/-(emerald|green)/, "success (text-success, bg-success/10, bg-success text-success-foreground)"],
  [/-(rose|red)/, "destructive (text-destructive, bg-destructive/10)"],
  [/-(amber|yellow|orange)/, "warning"],
  [/-sky/, "info"],
  [/-(purple|violet|pink|fuchsia|teal|lime)/, "a category color: chart-1 … chart-5"],
  [/^(?:.*:)?(?:bg|from|via|to|shadow)-(cyan|blue|indigo)/, "primary (bg-primary text-primary-foreground)"],
  [/^(?:.*:)?text-(cyan|blue|indigo)/, "text-primary"],
  [/^(?:.*:)?text-(slate|gray|zinc|neutral|stone)-(300|400|500|600)/, "text-muted-foreground"],
  [/^(?:.*:)?text-/, "text-foreground (on a solid fill: its -foreground pair)"],
  [/^(?:.*:)?(?:bg|from|via|to)-/, "bg-card, bg-muted, bg-popover or bg-background, by role"],
];
const suggest = (cls: string) => SUGGESTIONS.find(([re]) => re.test(cls))?.[1] ?? "a semantic theme token";

/** The literal color classes on each line of a source text, as [line number, class]. */
function literalClasses(source: string): [number, string][] {
  const found: [number, string][] = [];
  source.split("\n").forEach((line, i) => {
    for (const re of [PALETTE, HEX, COLOR_FN]) for (const m of line.matchAll(re)) found.push([i + 1, m[0]]);
  });
  return found;
}

function sources(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sources(rel);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [rel] : [];
  });
}

const fileMatches = (a: Allowed, file: string) => (typeof a.file === "string" ? a.file === file : a.file.test(file));

describe("colors come from theme tokens (rule ui-theme-tokens-only)", () => {
  it("finds the literal classes it is meant to catch, and leaves tokens alone", () => {
    const sample = [
      `<div className="text-slate-300 hover:bg-[#1a2352]">`,
      `<p className="dark:text-white/80 focus:ring-cyan-400 border-t-slate-100">`,
      `<span className="bg-card text-muted-foreground border-border bg-sidebar-accent text-chart-2 bg-success/10">`,
      `<b className="bg-[rgb(10,20,30)] text-[color:#fff] ring-offset-background">`,
    ].join("\n");
    expect(literalClasses(sample)).toEqual([
      [1, "text-slate-300"],
      [1, "hover:bg-[#1a2352]"],
      [2, "dark:text-white/80"],
      [2, "focus:ring-cyan-400"],
      [2, "border-t-slate-100"],
      [4, "text-[color:#fff]"],
      [4, "bg-[rgb("],
    ]);
  });

  const files = DIRS.flatMap(sources);
  const hits = files.flatMap((file) =>
    literalClasses(fs.readFileSync(path.join(root, file), "utf8")).map(([line, cls]) => ({ file, line, cls })),
  );

  it("finds no literal color outside the allow-list", () => {
    const report = hits
      .filter(({ file, cls }) => !ALLOWED.some((a) => fileMatches(a, file) && a.pattern.test(cls)))
      .map(({ file, line, cls }) => `${file}:${line}: ${cls} -> use ${suggest(cls)}`);
    expect(report, `Literal colors break other modes and presets; use a token or add an ALLOWED entry with its reason:\n${report.join("\n")}`).toEqual([]);
  });

  it("has no stale allow-list entry", () => {
    const stale = ALLOWED.filter((a) => !hits.some(({ file, cls }) => fileMatches(a, file) && a.pattern.test(cls)) && files.some((f) => fileMatches(a, f)));
    expect(stale.map((a) => `${a.file}: ${a.reason}`), "these exceptions match nothing any more: remove them from ALLOWED").toEqual([]);
  });
});
