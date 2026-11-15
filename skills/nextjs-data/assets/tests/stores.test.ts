import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rules store-narrow-selectors and store-persist-preferences-only, for Zustand stores. Place this
// file in <app-root>/tests/; root then resolves to the app.
//
// - store-narrow-selectors: a store hook (a module store `export const useX = create(...)`, or a
//   provider store's hook, an exported `useX` that calls useStore) is never called without a
//   selector or with `(s) => s`, and a selector that builds an object or array on every call
//   (`=> ({`, `=> [`, `.map(`, `.filter(`) is wrapped in useShallow; `useStore(store)` always takes a
//   selector.
// - store-persist-preferences-only: every `persist(` from zustand/middleware has options with
//   `skipHydration: true`, a `version` and a `partialize` that lists the keys it saves, none of them a
//   token, secret, password, session or email.
//
// It reads source text. It misses a store hook re-exported under another name and options built in
// a variable; whether a persisted value is really a per-device preference stays review.
const root = path.resolve(__dirname, "..");

const DIRS = ["app", "components", "src"];
// Persisted keys that are never a preference.
const SECRET_KEY = /token|secret|password|session|email/i;
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

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The source with comments blanked out (same length, same line breaks). */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\/|(^|[^:\\])\/\/[^\n]*/g, (m, pre = "") => pre + m.slice(pre.length).replace(/[^\n]/g, " "));
const lineOf = (src: string, at: number) => src.slice(0, at).split("\n").length;

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

/** The top-level, comma-separated arguments of the call whose `(` is at `open`. */
function args(source: string, open: number): string[] {
  const inner = source.slice(open + 1, closeOf(source, open) - 1);
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '"' || c === "'" || c === "`") { i = skipString(inner, i) - 1; continue; }
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && depth === 0) { parts.push(inner.slice(start, i)); start = i + 1; }
  }
  parts.push(inner.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** The text of `name: value` in an object literal's source, up to the next top-level comma. */
function prop(options: string, name: string): string | undefined {
  const m = new RegExp(String.raw`(?<![\w.$])${name}\s*:`).exec(options);
  if (!m) return undefined;
  let depth = 0;
  for (let i = m.index + m[0].length; i < options.length; i++) {
    const c = options[i];
    if (c === '"' || c === "'" || c === "`") { i = skipString(options, i) - 1; continue; }
    if ("([{".includes(c)) depth++;
    else if ((")]}".includes(c) && --depth < 0) || (c === "," && depth === 0)) return options.slice(m.index + m[0].length, i).trim();
  }
  return options.slice(m.index + m[0].length).trim();
}

/** The names of the store hooks a file defines: module stores, and provider-store hooks that pass
 * their selector parameter on to useStore (a hook with its selector built in takes no argument). */
function storeHooks(raw: string): string[] {
  const src = code(raw);
  const found = [...src.matchAll(/\bexport\s+const\s+(use[\w$]*)\s*=\s*create\s*(?:<[^>]*>)?\s*\(/g)].map((m) => m[1]);
  for (const m of src.matchAll(/\bexport\s+(?:function\s+(use[\w$]*)|const\s+(use[\w$]*)\s*=\s*)\s*(?:<[^>]*>)?\s*\(\s*([\w$]+)/g)) {
    const next = src.slice(m.index! + m[0].length).search(/\nexport\s/);
    const text = src.slice(m.index!, next < 0 ? undefined : m.index! + m[0].length + next);
    if (new RegExp(String.raw`(?<![\w.$])useStore\s*\([^,()]+,\s*${escape(m[3])}\s*\)`).test(text)) found.push(m[1] ?? m[2]);
  }
  return [...new Set(found)];
}

/** What a selector argument does wrong, or undefined. */
function selectorProblem(selector: string | undefined): string | undefined {
  if (selector === undefined) return "no selector: the component re-renders on every store change; select the slice it renders";
  if (/^\(?\s*([\w$]+)\s*\)?\s*=>\s*\1$/.test(selector)) return "selects the whole store: select the slice it renders";
  if (/^useShallow\s*\(/.test(selector)) return undefined;
  if (/=>\s*(?:\(\s*\{|\[)|\.(?:map|filter|slice|concat)\s*\(|Object\.(?:keys|values|entries)\s*\(/.test(selector))
    return "the selector builds a new object or array on every call: wrap it in useShallow(...)";
  return undefined;
}

/** Calls of store hooks (and of useStore) in a file that select too much, one line each. */
function wideSelectors(raw: string, hooks: string[]): string[] {
  const src = code(raw);
  const bad: string[] = [];
  const names = [...hooks.map(escape), "useStore"];
  for (const m of src.matchAll(new RegExp(String.raw`(?<![\w.$])(?<!function\s+)(${names.join("|")})\s*\(`, "g"))) {
    const a = args(src, m.index! + m[0].length - 1);
    const selector = m[1] === "useStore" ? a[1] : a[0];
    const problem = selectorProblem(selector);
    if (problem) bad.push(`${lineOf(src, m.index!)}: ${m[1]}(${a.join(", ").slice(0, 60)}): ${problem} (rule store-narrow-selectors)`);
  }
  return bad;
}

/** What each zustand `persist(` call in a file leaves out, one line each. */
function persistProblems(raw: string): string[] {
  const src = code(raw);
  if (!/\bimport\s*\{[^}]*\bpersist\b[^}]*\}\s*from\s*["']zustand\/middleware["']/.test(src)) return [];
  const bad: string[] = [];
  for (const m of src.matchAll(/(?<![\w.$])persist\s*\(/g)) {
    const options = args(src, m.index! + m[0].length - 1)[1] ?? "";
    const partialize = prop(options, "partialize");
    const missing = [
      !/(?<![\w.$])skipHydration\s*:\s*true\b/.test(options) && "skipHydration: true (then persist.rehydrate() once in an effect)",
      !prop(options, "version") && "a version",
      !partialize && "a partialize listing the saved keys",
      partialize && /\.\.\./.test(partialize) && "a partialize that lists each saved key instead of spreading the state",
      partialize && SECRET_KEY.test(partialize) && "no token, secret, password, session or email among the saved keys (sec-no-tokens-in-browser)",
    ].filter(Boolean);
    if (missing.length) bad.push(`${lineOf(src, m.index!)}: persist() needs ${missing.join("; ")} (rule store-persist-preferences-only)`);
  }
  return bad;
}

describe("Zustand stores select narrowly and persist only preferences (rules store-narrow-selectors, store-persist-preferences-only)", () => {
  it("tells narrow selectors from wide ones", () => {
    const hooks = [
      ...storeHooks(`export const usePrefs = create<Prefs>()(persist((set) => ({}), opts));`),
      ...storeHooks(`export function useSelection<T>(selector: (s: S) => T): T {\n  const store = useContext(Ctx);\n  return useStore(store, selector);\n}`),
    ];
    expect(hooks).toEqual(["usePrefs", "useSelection"]);
    const ok = `const count = useSelection((s) => s.ids.length);
const { ids, clear } = useSelection(useShallow((s) => ({ ids: s.ids, clear: s.clear })));
const density = usePrefs((s) => s.density);
usePrefs.persist.rehydrate();`;
    expect(wideSelectors(ok, hooks)).toEqual([]);
    const bad = `const { ids } = useSelection();
const all = usePrefs((s) => s);
const view = useSelection((s) => ({ ids: s.ids }));
const open = useSelection((s) => s.ids.filter((id) => id));
const store = useStore(selectionStore);`;
    expect(wideSelectors(bad, hooks).map((b) => b.split(":")[0])).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("tells a preference store from the rest", () => {
    const head = `import { persist } from "zustand/middleware";\n`;
    expect(persistProblems(`${head}persist((set) => ({ density: "comfortable" }), { name: "<app>-prefs", version: 1, partialize: (s) => ({ density: s.density }), skipHydration: true });`)).toEqual([]);
    expect(persistProblems(`${head}persist((set) => ({ accessToken: "" }), { name: "auth" });`)).toHaveLength(1);
    expect(persistProblems(`${head}persist(fn, { version: 1, skipHydration: true, partialize: (s) => ({ email: s.email }) });`)[0]).toContain("no token");
    expect(persistProblems(`await navigator.storage.persist();`)).toEqual([]);
  });

  const files = DIRS.flatMap(sources).map((file) => ({ file, src: fs.readFileSync(path.join(root, file), "utf8") }));
  const hooks = [...new Set(files.flatMap(({ src }) => storeHooks(src)))];

  it("finds every store hook called with a narrow selector", () => {
    const report = files.flatMap(({ file, src }) => wideSelectors(src, hooks).map((b) => `${file}:${b}`));
    expect(report, `Select the smallest slice; wrap selectors that build objects or arrays in useShallow (nextjs-data):\n${report.join("\n")}`).toEqual([]);
  });

  it("finds every persisted store hydrating after mount and saving only listed preferences", () => {
    const report = files.flatMap(({ file, src }) => persistProblems(src).map((b) => `${file}:${b}`));
    expect(report, `persist only per-device preferences, with skipHydration, a version and a partialize (nextjs-data):\n${report.join("\n")}`).toEqual([]);
  });
});
