import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rule ui-size-shorthand: `size-N` when width and height match. Fails on a `w-N` and an `h-N` with the
// same variant prefix, important mark and value in one string literal (`"w-10 h-10"`,
// `"md:w-6 md:h-6"`), template literals and the strings inside their `${...}` included. Place this
// file in <app-root>/tests/; root then resolves to the app.
//
// What it can't see: a pair split across two strings (`cn("w-4", "h-4")`) or built at runtime.
const root = path.resolve(__dirname, "..");

const DIRS = ["app", "components", "src"];
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", "coverage"]);
// Generated primitives keep the CLI's classes (re-running the CLI would undo an edit).
const GENERATED = [/^components\/shadcn-ui\//];
// Values whose w- and h- utilities differ, so there is no size- for them (100vw vs 100vh).
const NO_SIZE = new Set(["screen", "svw", "svh", "lvw", "lvh", "dvw", "dvh"]);
// Deliberate exceptions: the file, the pair's value, and why. It only shrinks: an entry that matches
// nothing fails the stale test.
const ALLOWED: { file: string; value: string; reason: string }[] = [
  // { file: "components/acme-ui/Avatar.tsx", value: "10", reason: "the width animates separately on hover" },
];

/** The string literals on a line; a template literal's text, plus the strings inside its `${...}`. */
function literals(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)].flatMap((m) =>
    m[3] === undefined ? [m[1] ?? m[2]] : m[3].split(/\$\{([^}]*)\}/).flatMap((part, i) => (i % 2 ? literals(part) : [part])),
  );
}

/** The w-/h- pairs on each line of a source text, as [line, "w-N h-N", "size-N", value]. */
function pairs(source: string): [number, string, string, string][] {
  const found: [number, string, string, string][] = [];
  source.split("\n").forEach((line, i) => {
    for (const text of literals(line)) {
      const seen = new Map<string, { variants: string; pre: string; post: string; value: string; axes: Set<string> }>();
      for (const token of text.split(/\s+/)) {
        // [variants][!]w-<value>[!]: the variant prefix and the important marks must match too.
        const m = token.match(/^((?:[^\s:]+:)*)(!?)([wh])-(\S+?)(!?)$/);
        if (!m || NO_SIZE.has(m[4])) continue;
        const [, variants, pre, axis, value, post] = m;
        const key = JSON.stringify([variants, pre, post, value]);
        if (!seen.has(key)) seen.set(key, { variants, pre, post, value, axes: new Set() });
        seen.get(key)!.axes.add(axis);
      }
      for (const { variants, pre, post, value, axes } of seen.values()) {
        if (axes.size < 2) continue;
        const cls = (axis: string) => `${variants}${pre}${axis}-${value}${post}`;
        found.push([i + 1, `${cls("w")} ${cls("h")}`, cls("size"), value]);
      }
    }
  });
  return found;
}

function sources(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sources(rel);
    return /\.[jt]sx?$/.test(entry.name) && !/\.(test|spec)\.[jt]sx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [rel] : [];
  });
}

describe("size-* when width and height match (rule ui-size-shorthand)", () => {
  it("finds matching w-/h- pairs per variant, and leaves the rest alone", () => {
    const sample = [
      `<Avatar className="w-10 h-10 rounded-full" />`,
      `<Icon className={cn("md:w-6 md:h-6 w-4", open && "h-[18px] w-[18px]")} />`,
      `<div className="w-4 md:h-4 h-6 min-w-4 min-h-4 w-screen h-screen size-8 max-w-sm" />`,
      "<span className={`flex ${small ? \"h-3 w-3\" : \"w-5 h-6\"} w-full! h-full!`} />",
    ].join("\n");
    expect(pairs(sample).map(([line, found, fix]) => `${line}: ${found} -> ${fix}`)).toEqual([
      "1: w-10 h-10 -> size-10",
      "2: md:w-6 md:h-6 -> md:size-6",
      "2: w-[18px] h-[18px] -> size-[18px]",
      "4: w-3 h-3 -> size-3",
      "4: w-full! h-full! -> size-full!",
    ]);
  });

  const files = DIRS.flatMap(sources).filter((f) => !GENERATED.some((re) => re.test(f)));
  const hits = files.flatMap((file) =>
    pairs(fs.readFileSync(path.join(root, file), "utf8")).map(([line, found, fix, value]) => ({ file, line, found, fix, value })),
  );
  const allowed = (h: (typeof hits)[number]) => ALLOWED.some((a) => a.file === h.file && a.value === h.value);

  it("uses size-* for every matching pair outside the allow-list", () => {
    const report = hits.filter((h) => !allowed(h)).map((h) => `${h.file}:${h.line}: ${h.found} -> ${h.fix}`);
    expect(report, `Use size-N when width and height match, or add an ALLOWED entry with its reason:\n${report.join("\n")}`).toEqual([]);
  });

  it("has no stale allow-list entry", () => {
    const stale = ALLOWED.filter((a) => !hits.some((h) => h.file === a.file && h.value === a.value));
    expect(stale.map((a) => `${a.file} (${a.value}): ${a.reason}`), "these exceptions match nothing any more: remove them from ALLOWED").toEqual([]);
  });
});
