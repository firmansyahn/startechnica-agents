import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rule data-optimistic-with-rollback: a mutation whose onMutate writes the cache (setQueryData)
// also cancels in-flight queries in onMutate, restores the snapshot in onError and invalidates in
// onSettled. Place this file in <app-root>/tests/; root then resolves to the app.
//
// It reads source text and checks the shape only: options built in a variable and passed in
// (`useMutation(options)`) aren't seen, and whether an optimistic update pays off here (a toggle, not
// a create) stays review.
const root = path.resolve(__dirname, "..");

const DIRS = ["app", "components", "src"];
// Calls that take mutation options: TanStack's own, and the project's wrappers (useFeedbackMutation).
const MUTATION_CALLS = /(?<![\w.$])(?:use[\w$]*Mutation|mutationOptions)\s*\(/g;
const SET_CACHE = /\.setQue(?:ry|ries)Data\s*\(/;
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", "coverage"]);

function sources(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : sources(rel);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [rel] : [];
  });
}

/** The source with comments blanked out (same length, same line breaks). */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\/|(^|[^:\\])\/\/[^\n]*/g, (m, pre = "") => pre + m.slice(pre.length).replace(/[^\n]/g, " "));

function skipString(source: string, i: number): number {
  for (let j = i + 1; j < source.length; j++) {
    if (source[j] === "\\") j++;
    else if (source[j] === source[i]) return j + 1;
  }
  return source.length;
}

/** The index just past the bracket that closes the one at `open`. */
function closeOf(source: string, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '"' || c === "'" || c === "`") { i = skipString(source, i) - 1; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c) && --depth === 0) return i + 1;
  }
  return source.length;
}

/** The end of a property value starting at `from`: the next `,` outside brackets, or the closing bracket. */
function valueEnd(source: string, from: number): number {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    const c = source[i];
    if (c === '"' || c === "'" || c === "`") { i = skipString(source, i) - 1; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c) && --depth < 0) return i;
    else if ((c === "," || c === ";") && depth === 0) return i;
  }
  return source.length;
}

/** The text of a property's value (`prop: value` or a method `prop(...) { ... }`) in `options`, or undefined. */
function prop(options: string, name: string): string | undefined {
  const m = new RegExp(String.raw`(?<![\w.$])${name}\s*(:|\()`).exec(options);
  if (!m) return undefined;
  const from = m.index + m[0].length;
  return options.slice(from, m[1] === ":" ? valueEnd(options, from) : closeOf(options, options.indexOf("{", closeOf(options, from - 1))));
}

/** What an optimistic mutation in `raw` leaves out, one line per mutation: `line: missing ...`. */
function missingRollback(raw: string): string[] {
  const src = code(raw);
  const bad: string[] = [];
  for (const m of src.matchAll(MUTATION_CALLS)) {
    const open = m.index! + m[0].length - 1;
    const options = src.slice(open, closeOf(src, open));
    const onMutate = prop(options, "onMutate");
    if (!onMutate || !SET_CACHE.test(onMutate)) continue;
    const onError = prop(options, "onError");
    const onSettled = prop(options, "onSettled");
    const missing = [
      !/\.cancelQueries\s*\(/.test(onMutate) && "cancelQueries in onMutate (a refetch in flight would overwrite the optimistic row)",
      !onError && "onError restoring the snapshot onMutate returns",
      !(onSettled && /\.invalidateQueries\s*\(/.test(onSettled)) && "onSettled invalidating the key",
    ].filter(Boolean);
    if (missing.length) bad.push(`${src.slice(0, m.index!).split("\n").length}: optimistic update without ${missing.join(", ")} (rule data-optimistic-with-rollback)`);
  }
  return bad;
}

describe("optimistic updates roll back (rule data-optimistic-with-rollback)", () => {
  it("tells a complete optimistic mutation from an incomplete one", () => {
    const full = `useMutation({
  mutationFn: (v) => runAction(() => setEnabled(v)),
  onMutate: async (v) => {
    await queryClient.cancelQueries({ queryKey: items.key(scope) });
    const before = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (row) => row && { ...row, enabled: v.enabled });
    return { before };
  },
  onError: (_e, _v, ctx) => queryClient.setQueryData(key, ctx?.before),
  onSettled: () => queryClient.invalidateQueries({ queryKey: items.key(scope) }),
});`;
    expect(missingRollback(full)).toEqual([]);
    expect(missingRollback(`useMutation({ mutationFn: save, onSuccess: (row) => queryClient.setQueryData(key, row) });`)).toEqual([]);
    expect(missingRollback(`const m = useFeedbackMutation({\n  mutationFn: save,\n  onMutate(v) { queryClient.setQueryData(key, v); },\n});`)).toEqual([
      "1: optimistic update without cancelQueries in onMutate (a refetch in flight would overwrite the optimistic row), onError restoring the snapshot onMutate returns, onSettled invalidating the key (rule data-optimistic-with-rollback)",
    ]);
  });

  const report = DIRS.flatMap(sources).flatMap((file) =>
    missingRollback(fs.readFileSync(path.join(root, file), "utf8")).map((b) => `${file}:${b}`),
  );

  it("finds every optimistic mutation complete", () => {
    expect(report, `An optimistic onMutate cancels queries and snapshots; onError restores; onSettled invalidates (nextjs-data):\n${report.join("\n")}`).toEqual([]);
  });
});
