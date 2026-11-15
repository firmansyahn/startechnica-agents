import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rule action-use-server-exports: every export of a "use server" file is an async
// function (each one becomes a callable endpoint; anything else fails the build or leaks), and no
// component defines an inline "use server" function (its closure is encrypted and sent to the
// browser). Place this file in <app-root>/tests/; root then resolves to the app.
const root = path.resolve(__dirname, "..");

const DIRS = ["app", "components", "src"];
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
