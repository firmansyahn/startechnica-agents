import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rules action-use-server-exports, sec-action-validate-unknown and bff-writes-via-apiaction, for
// "use server" files. Place this file in <app-root>/tests/; root then
// resolves to the app.
//
// - Every export of a "use server" file is an async function (each one becomes a callable endpoint;
//   anything else fails the build or leaks), and no component defines an inline "use server"
//   function (its closure is encrypted and sent to the browser).
// - Every exported action takes no parameter, or parameters typed `unknown` or `FormData` (with
//   useActionState, `(prevState, formData: FormData)`), and parses each of them with zod
//   (`schema.safeParse(input)`) before using it: TypeScript types are erased, the browser sends
//   anything.
// - No "use server" file calls fetch itself: writes go through the shared apiAction.
//
// It reads source text. It doesn't check that the schema is the one the form shares, nor that the
// parsed value, not the raw input, is what reaches the backend; review covers those.
const root = path.resolve(__dirname, "..");

const DIRS = ["app", "components", "src"];
// Calls that parse an action's input: zod's methods, and the project's own helper if it has one
// (e.g. PARSE_HELPERS = ["parseInput"]).
const PARSE_METHODS = ["safeParse", "parse", "safeParseAsync", "parseAsync"];
const PARSE_HELPERS: string[] = [];
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

const FILE_DIRECTIVE = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use server["']/;

/** What a "use server" file exports that isn't an async function, one line per problem. */
function badExports(src: string): string[] {
  const bad: string[] = [];
  const asyncLocals = new Set<string>();
  for (const m of src.matchAll(/\basync\s+function\s+([\w$]+)/g)) asyncLocals.add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([\w$]+)[^;\n]*?=(?!>)\s*async\b/g)) asyncLocals.add(m[1]);

  for (const m of src.matchAll(/^\s*export\s+(?!type\s|interface\s|declare\s)(default\s+)?(async\s+function|function|const|let|var|class|enum|\{|\*)\s*([\w$]*)/gm)) {
    const [, isDefault, kind, name] = m;
    const rest = src.slice(m.index! + m[0].length, m.index! + m[0].length + 200);
    if (kind === "async function") continue;
    if (kind === "const" && /^[^;\n]*?=(?!>)\s*async\b/.test(rest)) continue;
    if (kind === "{") {
      const list = balancedBraces(src, src.indexOf("{", m.index!));
      const from = /^\s*from\s*["']/.test(src.slice(src.indexOf("{", m.index!) + list.length));
      for (const part of list.slice(1, -1).split(",").map((p) => p.trim()).filter(Boolean)) {
        if (part.startsWith("type ")) continue;
        const local = part.split(/\s+as\s+/)[0];
        if (from || !asyncLocals.has(local)) bad.push(`export { ${part} }${from ? " from another module" : ""}: not an async function declared here`);
      }
      continue;
    }
    if (kind === "*") {
      bad.push("export * from another module: re-export each action explicitly, or import them where they're used");
      continue;
    }
    bad.push(`export ${isDefault ?? ""}${kind} ${name}`.replace(/\s+/g, " ").trim() + ": not an async function");
  }
  return bad;
}

function balancedBraces(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(open, i + 1);
  }
  return source.slice(open);
}

/** The source with comments blanked out (same length, same line breaks). */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\/|(^|[^:\\])\/\/[^\n]*/g, (m, pre = "") => pre + m.slice(pre.length).replace(/[^\n]/g, " "));
const lineOf = (src: string, at: number) => src.slice(0, at).split("\n").length;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

/** Splits `text` at its top-level commas. */
function topLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") { i = skipString(text, i) - 1; continue; }
    if ("([{<".includes(c)) depth++;
    else if (")]}".includes(c) || (c === ">" && text[i - 1] !== "=")) depth--;
    else if (c === "," && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** The body of the function whose parameter list closes at `from`: skips a return type, then a block or an arrow's expression. */
function functionBody(src: string, from: number): string {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === "(" || c === "[" || c === "<") depth++;
    else if (c === ")" || c === "]" || (c === ">" && src[i - 1] !== "=")) depth--;
    else if (depth === 0 && c === "{") return src.slice(i, closeOf(src, i));
    else if (depth === 0 && c === "=" && src[i + 1] === ">") {
      const start = src.slice(i + 2).search(/\S/) + i + 2;
      if (src[start] === "{") return src.slice(start, closeOf(src, start));
      const end = src.slice(start).search(/;|\n(?=\S)/);
      return src.slice(start, end < 0 ? undefined : start + end);
    }
  }
  return "";
}

type Action = { name: string; at: number; params: string[]; types?: string[]; body: string };

/** The exported actions of a "use server" file: `export async function`, `export const x = async`, and async locals in `export { }`. */
function actions(src: string): Action[] {
  const all: (Action & { exported: boolean })[] = [];
  for (const m of src.matchAll(/(\bexport\s+(?:default\s+)?)?\basync\s+function\s*([\w$]*)\s*(?:<[^>]*>)?\s*\(/g)) {
    const open = m.index! + m[0].length - 1;
    const close = closeOf(src, open);
    all.push({ name: m[2] || "default", at: m.index!, exported: !!m[1], params: topLevel(src.slice(open + 1, close - 1)), body: functionBody(src, close) });
  }
  for (const m of src.matchAll(/(\bexport\s+)?\bconst\s+([\w$]+)\s*(:[^\n]*?)?(?<![=!<>])=(?!>)\s*async\s*(?:<[^>]*>)?\s*(\(|[\w$]+\s*=>)/g)) {
    const isParen = m[4] === "(";
    const open = m.index! + m[0].length - 1;
    const close = isParen ? closeOf(src, open) : m.index! + m[0].length - 2;
    const params = isParen ? topLevel(src.slice(open + 1, close - 1)) : [m[4].replace(/\s*=>$/, "")];
    const annotation = m[3]?.match(/\(([^)]*)\)\s*=>/)?.[1];
    all.push({ name: m[2], at: m.index!, exported: !!m[1], params, types: annotation === undefined ? undefined : topLevel(annotation), body: functionBody(src, close) });
  }
  const listed = new Set(
    [...src.matchAll(/\bexport\s*\{([^}]*)\}(?!\s*from)/g)].flatMap((m) => m[1].split(",").map((p) => p.trim().split(/\s+as\s+/)[0])),
  );
  return all.filter((a) => a.exported || listed.has(a.name));
}

/** A parameter's name and declared type (undefined when untyped); destructured parameters have no name. */
function param(text: string): { name?: string; type?: string } {
  const m = text.match(/^(?:\.\.\.)?([\w$]+)\??\s*(?::\s*([^=]+?))?\s*(?:=.*)?$/s);
  return m ? { name: m[1], type: m[2]?.trim() } : { type: text.match(/[}\]]\s*:\s*([^=]+)/)?.[1]?.trim() };
}

const PARSE = new RegExp(
  String.raw`(?:\.(?:${PARSE_METHODS.map(escape).join("|")})${PARSE_HELPERS.length ? String.raw`|(?<![\w.$])(?:${PARSE_HELPERS.map(escape).join("|")})` : ""})\s*\(`,
  "g",
);

/** Exported actions that take a typed or unparsed input, one line per problem: `line: name: ...`. */
function unvalidatedInputs(raw: string): string[] {
  const src = code(raw);
  const bad: string[] = [];
  for (const a of actions(src)) {
    const params = a.params.map((p, i) => {
      const own = param(p);
      const declared = a.types?.[i] ? param(a.types[i]).type : undefined;
      return { text: p, name: own.name, type: own.type ?? declared };
    });
    const formStyle = params.length === 2 && params[1].type === "FormData";
    const where = `${lineOf(src, a.at)}: ${a.name}`;
    params.forEach((p, i) => {
      if (formStyle && i === 0) return;
      if (!p.name) bad.push(`${where}: destructures its input (${p.text}): take \`input: unknown\` and parse it with the shared schema`);
      else if (p.type !== "unknown" && p.type !== "FormData") bad.push(`${where}: parameter ${p.name} is ${p.type ? `typed ${p.type}` : "untyped"}: type it \`unknown\` (or FormData) and parse it with the shared schema`);
      else {
        const parsed = [...a.body.matchAll(PARSE)].some((m) => new RegExp(String.raw`(?<![\w.$])${escape(p.name!)}(?![\w$])`).test(a.body.slice(m.index! + m[0].length - 1, closeOf(a.body, m.index! + m[0].length - 1))));
        if (!parsed) bad.push(`${where}: never parses ${p.name}: const parsed = schema.safeParse(${p.name}); return a 422 Result when it fails`);
      }
    });
  }
  return bad.sort((x, y) => parseInt(x) - parseInt(y)).map((b) => `${b} (rule sec-action-validate-unknown)`);
}

/** Lines of a "use server" file that call fetch itself instead of going through apiAction. */
const directFetches = (raw: string) =>
  [...code(raw).matchAll(/(?<![\w.$])fetch\s*\(/g)].map((m) => `${lineOf(raw, m.index!)}: calls fetch: send the write through apiAction(method, path, opts), which forwards the session and returns a Result (rule bff-writes-via-apiaction)`);

/** Whether a module has a "use server" directive anywhere but its top: an inline server function,
 * on its own line or opening a one-line body (`{ "use server"; ... }`). */
const inlineDirective = (src: string) => !FILE_DIRECTIVE.test(src) && /(^\s+|[{;]\s*)["']use server["']\s*(;|$)/m.test(src);

describe('"use server" files export only async functions (rule action-use-server-exports)', () => {
  it("tells async function exports from the rest", () => {
    const src = `"use server";
import { z } from "zod";
export async function saveItem(input: unknown) {}
export const removeItem = async (input: unknown) => {};
export const typed: (input: unknown) => Promise<void> = async (input) => {};
export const itemInput = z.object({});
export function helper() {}
export type ItemInput = z.infer<typeof itemInput>;
async function local() {}
export { local, itemInput as schema };
export { other } from "./other";`;
    expect(badExports(src)).toEqual([
      "export const itemInput: not an async function",
      "export function helper: not an async function",
      "export { itemInput as schema }: not an async function declared here",
      "export { other } from another module: not an async function declared here",
    ]);
    expect(inlineDirective(`export function Page() {\n  async function go() {\n    "use server";\n  }\n}`)).toBe(true);
    expect(inlineDirective(`"use server";\nexport async function a() {}`)).toBe(false);
    expect(inlineDirective(`export function Page() {\n  async function go() { "use server"; await save(); }\n}`)).toBe(true);
    expect(inlineDirective(`const label = "use server";`)).toBe(false);
  });

  const files = DIRS.flatMap(sources).map((file) => ({ file, src: fs.readFileSync(path.join(root, file), "utf8") }));

  it("finds nothing else exported from a \"use server\" file", () => {
    const report = files
      .filter(({ src }) => FILE_DIRECTIVE.test(src))
      .flatMap(({ file, src }) => badExports(src).map((b) => `${file}: ${b}`));
    expect(report, `Move schemas, types and constants to a sibling file (input.ts, schema.ts) and import them:\n${report.join("\n")}`).toEqual([]);
  });

  it("finds no inline \"use server\" function", () => {
    const report = files.filter(({ src }) => inlineDirective(src)).map(({ file }) => file);
    expect(report, `Move each inline server function into the domain's actions.ts and call it with useMutation:\n${report.join("\n")}`).toEqual([]);
  });
});

describe('actions parse unknown input and write through apiAction (rules sec-action-validate-unknown, bff-writes-via-apiaction)', () => {
  it("tells parsed unknown input from typed or unparsed input", () => {
    const ok = `"use server";
export async function saveItem(input: unknown): Promise<Result<Item>> {
  const parsed = saveItemInput.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  return apiAction("PATCH", \`items/\${encodeURIComponent(parsed.data.id)}\`, { body: parsed.data.changes });
}
export const removeItem = async (input: unknown) => apiAction("DELETE", path(removeItemInput.parse(input).id));
export async function signUp(prev: FormState, formData: FormData) { const v = signUpInput.safeParse(Object.fromEntries(formData)); }
export async function refreshAll() { return apiAction("POST", "items/refresh"); }
export const typed: (input: unknown) => Promise<void> = async (input) => { itemInput.parse(input); };`;
    expect(unvalidatedInputs(ok)).toEqual([]);
    const bad = `"use server";
export async function saveItem(input: ItemInput) {
  return apiAction("PATCH", \`items/\${input.id}\`, { body: input });
}
export const removeItem = async ({ id }: { id: string }) => apiAction("DELETE", id);
export async function rename(input: unknown) { return apiAction("PATCH", "x", { body: input }); }
async function archive(input) { archiveInput.parse(other); }
export { archive };`;
    expect(unvalidatedInputs(bad).map((b) => b.split(":").slice(0, 2).join(":"))).toEqual(["2: saveItem", "5: removeItem", "6: rename", "7: archive"]);
    expect(directFetches(`"use server";\n// fetch("x")\nexport async function a() { return fetch(\`\${API}/items\`, { method: "POST" }); }`)).toHaveLength(1);
    expect(directFetches(`"use server";\nexport async function a() { return apiAction("POST", "items"); }`)).toEqual([]);
  });

  const files = DIRS.flatMap(sources)
    .map((file) => ({ file, src: fs.readFileSync(path.join(root, file), "utf8") }))
    .filter(({ src }) => FILE_DIRECTIVE.test(src));

  it("finds every exported action parsing unknown input", () => {
    const report = files.flatMap(({ file, src }) => unvalidatedInputs(src).map((b) => `${file}:${b}`));
    expect(report, `Take \`input: unknown\` (or FormData) and parse it with the shared zod schema before using it (nextjs-data):\n${report.join("\n")}`).toEqual([]);
  });

  it("finds no fetch in a \"use server\" file", () => {
    const report = files.flatMap(({ file, src }) => directFetches(src).map((b) => `${file}:${b}`));
    expect(report, `Writes go through the shared apiAction, not a fetch of their own (nextjs-bff):\n${report.join("\n")}`).toEqual([]);
  });
});
