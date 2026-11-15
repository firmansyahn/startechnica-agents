import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rules data-mutation-via-runaction, forms-submit-via-mutation and action-writes-only: a server
// action (a name imported from an `actions` module) is called only from a useMutation's mutationFn,
// wrapped in runAction, and never to read (in a queryFn) or in parallel (in Promise.all). Place this
// file in <app-root>/tests/; root then resolves to the app.
//
// It reads source text, not a syntax tree. It sees calls of imported action names and of a namespace
// import (`actions.saveItem(...)`). It misses an action passed through a variable or a prop and then
// called, a sequential loop of actions, and whether a form's Save is disabled while pending (the
// data-ispending-for-buttons scan lists the separate saving-state half).
const root = path.resolve(__dirname, "..");

// Components, pages and hooks: every action call there sits in a mutationFn, inside runAction.
const UI_DIRS = ["app", "components", "src/hooks"];
// The services registry: an action called in a queryFn there is a read through an action.
const REGISTRY_DIRS = ["src/services"];
// Imports from these modules are server actions.
const ACTION_MODULE = /(?:^|\/)actions(?:\.tsx?)?$/;
// Calls that unwrap an action's Result into a thrown ApiError. Add the project's feedback wrapper if
// it takes a callback and unwraps it itself.
const UNWRAP_CALLS = ["runAction"];
// Properties whose value is the mutation's function.
const MUTATION_PROPS = ["mutationFn"];
// Files that still call an action another way, each with its reason. It only shrinks: a file that no
// longer does fails the last test until it is removed.
const EXEMPT: Record<string, string> = {
  // "app/legacy/page.tsx": "converted to useMutation in <ticket>",
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
const USE_SERVER = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use server["']/;

/** The source with comments blanked out (same length, same line breaks), so commented code isn't checked. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\/|(^|[^:\\])\/\/[^\n]*/g, (m, pre = "") => pre + m.slice(pre.length).replace(/[^\n]/g, " "));

/** The index just past the string literal that opens at `i`. */
function skipString(source: string, i: number): number {
  const quote = source[i];
  for (let j = i + 1; j < source.length; j++) {
    if (source[j] === "\\") j++;
    else if (source[j] === quote) return j + 1;
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

/** The end of a property value starting at `from`: the next `,` or `;` outside brackets, or the closing bracket. */
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

/** The local names a file imports from an actions module, and its namespace imports of one. */
function actionImports(src: string): { names: Set<string>; namespaces: Set<string> } {
  const names = new Set<string>();
  const namespaces = new Set<string>();
  for (const m of src.matchAll(/\bimport\s+(?!type\s)([^;"'`]*?)\s*from\s*["']([^"']+)["']/g)) {
    if (!ACTION_MODULE.test(m[2])) continue;
    const clause = m[1];
    const ns = clause.match(/\*\s*as\s+([\w$]+)/)?.[1];
    if (ns) namespaces.add(ns);
    for (const part of (clause.match(/\{([^}]*)\}/)?.[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (name && !part.trim().startsWith("type ")) names.add(name);
    }
    const def = clause.replace(/\{[^}]*\}/, "").replace(/\*\s*as\s+[\w$]+/, "").replace(/,/g, " ").trim();
    if (/^[\w$]+$/.test(def)) names.add(def);
  }
  return { names, namespaces };
}

type Range = [number, number];
const inside = (at: number, ranges: Range[]) => ranges.some(([a, b]) => at > a && at < b);

/** The argument ranges of every call of one of `callees` (`Promise.all` included). */
function callRanges(src: string, callees: string[]): Range[] {
  const re = new RegExp(String.raw`(?<![\w.$])(?:${callees.map(escape).join("|")})\s*\(`, "g");
  return [...src.matchAll(re)].map((m) => {
    const open = m.index! + m[0].length - 1;
    return [open, closeOf(src, open)];
  });
}

/** The value ranges of every `prop: value` and `prop(...) { ... }` in the file, and the values' text. */
function propRanges(src: string, props: string[]): { range: Range; text: string }[] {
  const re = new RegExp(String.raw`(?<![\w.$])(?:${props.map(escape).join("|")})\s*(:|\()`, "g");
  return [...src.matchAll(re)].map((m) => {
    const from = m.index! + m[0].length;
    const end = m[1] === ":" ? valueEnd(src, from) : closeOf(src, src.indexOf("{", closeOf(src, from - 1)));
    return { range: [m.index!, end] as Range, text: src.slice(from, end).trim() };
  });
}

/** Problems with how a file calls actions, one per call site: `line: message (rule ...)`. */
function badActionCalls(raw: string, ui: boolean): string[] {
  const src = code(raw);
  const { names, namespaces } = actionImports(src);
  if (names.size === 0 && namespaces.size === 0) return [];
  const parts = [...[...names].map(escape), ...[...namespaces].map((n) => String.raw`${escape(n)}\.[\w$]+`)];
  const bareRe = new RegExp(String.raw`^(?:${parts.join("|")})$`);
  const callRe = new RegExp(String.raw`(?<![\w.$])(${parts.join("|")})\s*\(`, "g");
  const reads = propRanges(src, ["queryFn"]).map((p) => p.range);
  const parallel = callRanges(src, ["Promise.all", "Promise.allSettled"]);
  const unwrap = callRanges(src, UNWRAP_CALLS);
  const mutations = propRanges(src, MUTATION_PROPS);
  const line = (at: number) => src.slice(0, at).split("\n").length;
  const bad: string[] = [];

  for (const m of src.matchAll(callRe)) {
    const at = m.index!;
    const name = m[1];
    if (inside(at, reads)) bad.push(`${line(at)}: ${name}() in a queryFn: an action is a write; read through the services registry (rule action-writes-only)`);
    else if (inside(at, parallel)) bad.push(`${line(at)}: ${name}() in Promise.all: actions run one at a time anyway; batch the work inside one action (rule action-writes-only)`);
    else if (!ui) continue;
    else if (!inside(at, mutations.map((p) => p.range))) bad.push(`${line(at)}: ${name}() called directly: call it from a useMutation's mutationFn (form.handleSubmit -> save.mutateAsync) so the cache update and error mapping run (rule forms-submit-via-mutation)`);
    else if (!inside(at, unwrap)) bad.push(`${line(at)}: ${name}() in mutationFn without runAction: wrap it, mutationFn: (v) => runAction(() => ${name}(v)), or a refused Result looks like a success (rule data-mutation-via-runaction)`);
  }
  if (ui) {
    for (const { range, text } of mutations) {
      if (bareRe.test(text)) {
        bad.push(`${line(range[0])}: mutationFn: ${text}: wrap it, mutationFn: (v) => runAction(() => ${text}(v)), or a refused Result looks like a success (rule data-mutation-via-runaction)`);
      }
    }
  }
  return bad.sort((a, b) => parseInt(a) - parseInt(b));
}

describe("server actions are called through useMutation and runAction, for writes only", () => {
  it("tells the allowed calls from the rest", () => {
    const head = `import { saveItem, deleteItem } from "@/src/services/items/actions";\nimport * as tags from "./actions";\n`;
    const ok = `${head}const save = useMutation({ mutationFn: (v) => runAction(() => saveItem({ ...v, scope })), onSuccess: () => {} });
const del = useMutation({ async mutationFn(id) { return runAction(() => deleteItem({ id })); } });
// await saveItem(v);
const [state, formAction] = useActionState(saveItem, initial);
const t = useMutation({ mutationFn: (v) => runAction(() => tags.addTag(v)) });`;
    expect(badActionCalls(ok, true)).toEqual([]);
    const bad = `${head}const save = useMutation({ mutationFn: (v) => saveItem(v) });
const del = useMutation({ mutationFn: deleteItem });
async function onSubmit(v) { await runAction(() => saveItem(v)); }
const q = useQuery({ queryKey: ["x"], queryFn: () => tags.listTags() });
await Promise.all(ids.map((id) => runAction(() => deleteItem({ id }))));`;
    expect(badActionCalls(bad, true).map((b) => b.replace(/:.*\(rule /, " (rule "))).toEqual([
      "3 (rule data-mutation-via-runaction)",
      "4 (rule data-mutation-via-runaction)",
      "5 (rule forms-submit-via-mutation)",
      "6 (rule action-writes-only)",
      "7 (rule action-writes-only)",
    ]);
    expect(badActionCalls(`import { listItems } from "./actions";\nexport const items = { list: () => ({ queryKey: ["items"], queryFn: () => listItems() }) };`, false)).toHaveLength(1);
    expect(badActionCalls(`import { saveItem } from "./actions";\nexport async function run() { await saveItem(); }`, false)).toEqual([]);
  });

  const files = [
    ...UI_DIRS.flatMap(sources).map((file) => ({ file, ui: true })),
    ...REGISTRY_DIRS.flatMap(sources).filter((f) => !UI_DIRS.some((d) => f.startsWith(`${d}/`))).map((file) => ({ file, ui: false })),
  ]
    .map(({ file, ui }) => ({ file, ui, src: read(file) }))
    .filter(({ src }) => !USE_SERVER.test(src));
  const found = files.map(({ file, ui, src }) => ({ file, bad: badActionCalls(src, ui) })).filter(({ bad }) => bad.length > 0);

  it("finds every action call in a mutationFn, through runAction, outside the exempt list", () => {
    const report = found.filter(({ file }) => !(file in EXEMPT)).flatMap(({ file, bad }) => bad.map((b) => `${file}:${b}`));
    expect(report, `Call server actions only as useMutation({ mutationFn: (v) => runAction(() => action(v)) }) (nextjs-data):\n${report.join("\n")}`).toEqual([]);
  });

  it("has no stale exemption", () => {
    const stale = Object.keys(EXEMPT).filter((f) => !found.some(({ file }) => file === f));
    expect(stale, "these no longer call actions another way: remove them from EXEMPT").toEqual([]);
  });
});
