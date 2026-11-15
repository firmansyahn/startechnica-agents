import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rules data-no-effect-fetch and data-no-writes-in-effects: client components read server data
// with useQuery and write with useMutation from a user event, never in a useEffect: no fetch there,
// directly, through one of the file's own functions (`load()`), through an imported helper that
// fetches or through a server action, and no mutation fired there (`save.mutate(v)`,
// `mutateAsync(v)`, a `mutate` destructured from a mutation hook). Place this file in
// <app-root>/tests/; root then resolves to the app.
//
// It reads source text, not a syntax tree: it follows function names within a file and exported
// helpers across files, which catches the usual shapes. A fetch or write hidden behind a hook or a
// callback prop isn't seen, nor a write during render; review catches those.
const root = path.resolve(__dirname, "..");

// Where components and pages live (checked), and where shared helpers live (followed).
const CHECKED_DIRS = ["app", "components"];
const HELPER_DIRS = ["src"];
// Calls that reach the network. Add the project's own transport (e.g. "apiFetch") here.
const NETWORK_CALLS = ["fetch", "axios", "axios.get", "axios.post", "ky", "ofetch"];
// Imports from these modules are server actions: calling one is a write (or a read through an action).
const ACTION_MODULE = /(?:^|\/)actions(?:\.tsx?)?$/;
// Files that still fetch in an effect, each with its reason. It only shrinks: a file that no longer
// does fails the last test until it is removed. Effects that are deliberate (a one-time OAuth code
// exchange, a session timer) stay here with that reason; legacy pages leave as they are converted.
const EXEMPT: Record<string, string> = {
  // "app/auth/callback/page.tsx": "trades the one-time authorization code; a retried or cached query would replay it",
};
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

const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NETWORK = new RegExp(String.raw`(?<![\w.$])(?:${NETWORK_CALLS.map(escape).join("|")})\s*\(`);
// A mutation fired: `save.mutate(v)`, `remove.mutateAsync(id)`.
const MUTATE = /\.mutate(?:Async)?\s*\(/;
const reaches = (text: string) => NETWORK.test(text) || MUTATE.test(text);
const calls = (name: string) => new RegExp(String.raw`(?<![\w.$])${escape(name)}\s*\(`);
const names = (name: string) => new RegExp(String.raw`(?<![\w.$])${escape(name)}(?![\w$])`);

/** The text from the bracket at `open` to its matching close. */
function balanced(source: string, open: number, pair = "()"): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === pair[0]) depth++;
    else if (source[i] === pair[1] && --depth === 0) return source.slice(open, i + 1);
  }
  return source.slice(open);
}

/** A function body starting at `from`: a `{ ... }` block, or an expression up to `;` or a closing bracket. */
function body(source: string, from: number): string {
  const start = source.slice(from).search(/\S/) + from;
  if (source[start] === "{") return balanced(source, start, "{}");
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c) && --depth < 0) return source.slice(start, i);
    else if (c === ";" && depth === 0) return source.slice(start, i);
  }
  return source.slice(start);
}

/** The file's own named functions and their bodies: declarations and arrow functions (also in useCallback). */
function functions(src: string): Map<string, string> {
  const bodies = new Map<string, string>();
  for (const m of src.matchAll(/\bfunction\s+([\w$]+)\s*(?:<[^>]*>)?\s*\(/g)) {
    const params = balanced(src, m.index! + m[0].length - 1);
    bodies.set(m[1], balanced(src, src.indexOf("{", m.index! + m[0].length - 1 + params.length), "{}"));
  }
  for (const m of src.matchAll(/\bconst\s+([\w$]+)\s*=\s*(?:useCallback\(\s*)?(?:async\s*)?(?:<[^>]*>)?\([^)]*\)\s*(?::[^=]+)?=>/g)) {
    bodies.set(m[1], body(src, m.index! + m[0].length));
  }
  return bodies;
}

/** Names of the file's functions that reach the network, directly or through `known` or each other. */
function fetchingFunctions(src: string, known: Set<string> = new Set()): Set<string> {
  const bodies = functions(src);
  const fetching = new Set(known);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [name, text] of bodies) {
      if (fetching.has(name)) continue;
      if (reaches(text) || [...fetching].some((f) => calls(f).test(text))) {
        fetching.add(name);
        grew = true;
      }
    }
  }
  return fetching;
}

/** The local names a file imports, with the module each comes from. */
function imported(src: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of src.matchAll(/\bimport\s+(?!type\s)([^;"'`]*?)\s*from\s*["']([^"']+)["']/g)) {
    const clause = m[1];
    const braces = clause.match(/\{([^}]*)\}/)?.[1] ?? "";
    for (const part of braces.split(",")) {
      const name = part.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop();
      if (name && !part.trim().startsWith("type ")) found.set(name, m[2]);
    }
    const def = clause.replace(/\{[^}]*\}/, "").replace(/,/g, " ").trim();
    if (/^[\w$]+$/.test(def)) found.set(def, m[2]);
  }
  return found;
}

/** Exported functions in the given files that reach the network: shared helpers such as `loadReport`. */
function exportedFetchers(files: string[]): Set<string> {
  const result = new Set<string>();
  for (const file of files) {
    const src = read(file);
    const fetching = fetchingFunctions(src);
    for (const m of src.matchAll(/\bexport\s+(?:async\s+)?(?:function|const)\s+([\w$]+)/g)) if (fetching.has(m[1])) result.add(m[1]);
  }
  return result;
}

/** The local names of `mutate`/`mutateAsync` destructured from a mutation hook: `const { mutate: save } = useMutation(...)`. */
function mutateLocals(src: string): Set<string> {
  const found = new Set<string>();
  for (const m of src.matchAll(/\bconst\s*\{([^}]*)\}\s*=\s*use[\w$]*Mutation\s*\(/g)) {
    for (const part of m[1].split(",")) {
      const [key, local] = part.split(":").map((s) => s.trim());
      if (key === "mutate" || key === "mutateAsync") found.add(local || key);
    }
  }
  return found;
}

/** The lines of the useEffect calls in `src` that fetch or write, given the helpers known to fetch. */
function effectLines(src: string, helpers: Set<string>): number[] {
  const known = mutateLocals(src);
  for (const [name, from] of imported(src)) if (helpers.has(name) || ACTION_MODULE.test(from)) known.add(name);
  const fetching = fetchingFunctions(src, known);
  return [...src.matchAll(/\buseEffect\s*\(/g)]
    .filter((m) => {
      const effect = balanced(src, m.index! + m[0].length - 1);
      return reaches(effect) || [...fetching].some((f) => names(f).test(effect));
    })
    .map((m) => src.slice(0, m.index!).split("\n").length);
}

const effectFetches = (src: string, helpers: Set<string>) => effectLines(src, helpers).length > 0;

describe("server data goes through TanStack Query, not effects (rules data-no-effect-fetch, data-no-writes-in-effects)", () => {
  it("finds a fetch in an effect, directly or through the file's own functions", () => {
    expect(effectFetches(`useEffect(() => { fetch("/x").then(set); }, []);`, new Set())).toBe(true);
    expect(effectFetches(`const load = async () => set(await (await fetch("/x")).json()); useEffect(() => { load(); }, []);`, new Set())).toBe(true);
    expect(effectFetches(`function get() { return fetch("/x"); } const load = useCallback(async () => set(await get()), []); useEffect(() => { void load(); }, [load]);`, new Set())).toBe(true);
    expect(effectFetches(`const close = () => setOpen(false); useEffect(() => { close(); }, [a]); const q = useQuery({ queryFn: () => fetch("/x") });`, new Set())).toBe(false);
  });

  it("follows imported helpers and server actions", () => {
    const helpers = exportedFetchers([]);
    expect(effectFetches(`import { loadReport } from "@/libs/reports"; useEffect(() => { loadReport().then(set); }, []);`, new Set(["loadReport"]))).toBe(true);
    expect(effectFetches(`import { saveItem } from "@/services/items/actions"; useEffect(() => { void saveItem(v); }, [v]);`, helpers)).toBe(true);
    expect(effectFetches(`import { cn } from "@/libs/utils"; useEffect(() => { cn("a"); }, []);`, helpers)).toBe(false);
  });

  it("finds a mutation fired in an effect (rule data-no-writes-in-effects)", () => {
    expect(effectFetches(`const save = useSaveItem(); useEffect(() => { if (dirty) save.mutate(v); }, [dirty]);`, new Set())).toBe(true);
    expect(effectFetches(`const { mutateAsync: save } = useMutation(opts); useEffect(() => { void save(v); }, [v]);`, new Set())).toBe(true);
    expect(effectFetches(`const autosave = () => save.mutateAsync(v); useEffect(() => { autosave(); }, [v]);`, new Set())).toBe(true);
    expect(effectLines(`const save = useSaveItem();\nuseEffect(() => { form.reset(row); }, [row]);\nconst onClick = () => save.mutate(v);`, new Set())).toEqual([]);
  });

  const checked = CHECKED_DIRS.flatMap(sources);
  const helpers = exportedFetchers([...checked, ...HELPER_DIRS.flatMap(sources)]);
  const found = checked.map((file) => ({ file, lines: effectLines(read(file), helpers) })).filter(({ lines }) => lines.length > 0);

  it("has no useEffect that fetches or writes, outside the exempt list", () => {
    const report = found.filter(({ file }) => !(file in EXEMPT)).map(({ file, lines }) => `${file}:${lines.join(",")}`);
    expect(report, `Read with useQuery, and write with useMutation from the user's event (submit, click, confirm), not in a useEffect (nextjs-data):\n${report.join("\n")}`).toEqual([]);
  });

  it("has no stale exemption", () => {
    const stale = Object.keys(EXEMPT).filter((f) => !found.some(({ file }) => file === f));
    expect(stale, "these no longer fetch or write in an effect: remove them from EXEMPT").toEqual([]);
  });
});
