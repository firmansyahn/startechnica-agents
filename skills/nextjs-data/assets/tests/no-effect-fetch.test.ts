import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rule data-no-effect-fetch: client components read server data with useQuery and write
// with useMutation, never in a useEffect: directly, through one of the file's own functions
// (`load()`), through an imported helper that fetches, or through a server action. Place this file
// in <app-root>/tests/; root then resolves to the app.
//
// It reads source text, not a syntax tree: it follows function names within a file and exported
// helpers across files, which catches the usual shapes. A fetch hidden behind a hook or a callback
// prop isn't seen; review catches those.
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
      if (NETWORK.test(text) || [...fetching].some((f) => calls(f).test(text))) {
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

/** Whether any useEffect in `src` reaches the network, given the helpers known to fetch. */
function effectFetches(src: string, helpers: Set<string>): boolean {
  const known = new Set<string>();
  for (const [name, from] of imported(src)) if (helpers.has(name) || ACTION_MODULE.test(from)) known.add(name);
  const fetching = fetchingFunctions(src, known);
  return [...src.matchAll(/\buseEffect\s*\(/g)].some((m) => {
    const effect = balanced(src, m.index! + m[0].length - 1);
    return NETWORK.test(effect) || [...fetching].some((f) => names(f).test(effect));
  });
}

describe("server data goes through TanStack Query (rule data-no-effect-fetch)", () => {
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

  const checked = CHECKED_DIRS.flatMap(sources);
  const helpers = exportedFetchers([...checked, ...HELPER_DIRS.flatMap(sources)]);
  const found = checked.filter((file) => effectFetches(read(file), helpers));

  it("has no useEffect that fetches, outside the exempt list", () => {
    const report = found.filter((f) => !(f in EXEMPT));
    expect(report, `Read with useQuery and write with useMutation (nextjs-data), not in a useEffect:\n${report.join("\n")}`).toEqual([]);
  });

  it("has no stale exemption", () => {
    const stale = Object.keys(EXEMPT).filter((f) => !found.includes(f));
    expect(stale, "these no longer fetch in an effect: remove them from EXEMPT").toEqual([]);
  });
});
