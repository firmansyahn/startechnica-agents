import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rule struct-server-only: server code is marked `import "server-only"`, so a client
// import fails the build instead of shipping it (and its secrets and environment reads) to the
// browser; and "use client" files import only types from the server-only folders. Place this file
// in <app-root>/tests/; root then resolves to the app.
const root = path.resolve(__dirname, "..");

// Folders whose every module is server-only (the BFF: session, tokens, proxy, backend calls).
const SERVER_DIRS = ["src/api"];
// Shared folders where a module that uses a server-only API must say so. app/ is left out: its
// pages, layouts and route handlers are server entry points by convention.
const SHARED_DIRS = ["src", "components"];
// Imports that make a module server code.
const SERVER_APIS = /^(?:next\/headers|node:\w+|fs|crypto|child_process|ioredis|redis|@redis\/client|pino|pg|postgres|mysql2|@prisma\/client|drizzle-orm(?:\/.*)?)$/;
// How "@/..." imports map onto folders under root (tsconfig paths).
const ALIASES: [string, string][] = [["@/", ""]];
// Modules in a server folder that the browser may import, with the reason. They must hold no
// secret and use no server API; they don't import "server-only".
const CLIENT_SAFE: Record<string, string> = {
  "src/api/result.ts": "Result, ApiError and errorText are shared by server actions and the browser's runAction",
};
// Files exempt from a check, with the reason. Every entry must still exist.
const EXEMPT: Record<string, string> = {
  // "src/libs/env.ts": "reads process.env only, on both sides, with no secrets",
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

interface Import {
  spec: string;
  typeOnly: boolean;
}

/** The module's static imports and re-exports, and whether each brings in types only. */
function imports(source: string): Import[] {
  const found: Import[] = [];
  const statement = /^\s*(?:import\s+(type\s+)?([^;"'`]*?)|export\s+(type\s+)?(\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?))\s*from\s*["']([^"']+)["']/gm;
  for (const m of source.matchAll(statement)) {
    const clause = (m[2] ?? m[4]).trim();
    const names = clause.match(/\{([\s\S]*)\}/)?.[1].split(",").map((n) => n.trim()).filter(Boolean) ?? [];
    const allTypes = clause.startsWith("{") && names.length > 0 && names.every((n) => n.startsWith("type "));
    found.push({ spec: m[5], typeOnly: Boolean(m[1] ?? m[3]) || allTypes });
  }
  for (const m of source.matchAll(/^\s*import\s*["']([^"']+)["']/gm)) found.push({ spec: m[1], typeOnly: false });
  return found;
}

/** The root-relative path an import points at, or null for a package. */
function resolve(fromFile: string, spec: string): string | null {
  if (spec.startsWith(".")) return path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), spec));
  for (const [alias, target] of ALIASES) if (spec.startsWith(alias)) return target + spec.slice(alias.length);
  return null;
}

const directive = (source: string, name: string) =>
  new RegExp(String.raw`^(?:\s|//[^\n]*\n|/\*[\s\S]*?\*/)*["']${name}["']`).test(source);
const marked = (source: string) => /^\s*import\s+["']server-only["']/m.test(source);
// A module with no runtime code (generated API types, shared interfaces) has nothing to leak.
const typesOnly = (source: string) =>
  !/^\s*(?:export\s+(?!type\s|interface\s|declare\s)|(?:const|let|var|function|class|async)\s)/m.test(source) &&
  imports(source).every((i) => i.typeOnly);
const inServerDir = (rel: string | null) => rel !== null && SERVER_DIRS.some((d) => rel === d || rel.startsWith(`${d}/`));

describe("server code is server-only (rule struct-server-only)", () => {
  it("parses imports, type-only imports and directives", () => {
    const src = `"use client";\nimport type { A } from "@/src/api/result";\nimport { type B, type C } from "../api/x";\nimport { d, type E } from "@/src/api/y";\nimport "server-only";`;
    expect(imports(src)).toEqual([
      { spec: "@/src/api/result", typeOnly: true },
      { spec: "../api/x", typeOnly: true },
      { spec: "@/src/api/y", typeOnly: false },
      { spec: "server-only", typeOnly: false },
    ]);
    expect(directive(src, "use client")).toBe(true);
    expect(resolve("src/hooks/useX.ts", "../api/x")).toBe("src/api/x");
  });

  it('marks every module in the server folders and every shared module using a server API with import "server-only"', () => {
    const report: string[] = [];
    for (const file of SHARED_DIRS.flatMap(sources)) {
      if (file in EXEMPT || file in CLIENT_SAFE) continue;
      const src = read(file);
      if (marked(src) || directive(src, "use server") || typesOnly(src)) continue;
      const api = imports(src).find((i) => !i.typeOnly && SERVER_APIS.test(i.spec));
      if (inServerDir(file)) report.push(`${file}: in a server-only folder`);
      else if (api) report.push(`${file}: imports ${api.spec}`);
    }
    expect(report, `Add import "server-only" as the first import of each (or move the file to a server folder):\n${report.join("\n")}`).toEqual([]);
  });

  it('imports only types from the server folders in "use client" files', () => {
    const report: string[] = [];
    for (const file of ["app", ...SHARED_DIRS].flatMap(sources)) {
      if (file in EXEMPT || inServerDir(file)) continue;
      const src = read(file);
      if (!directive(src, "use client")) continue;
      for (const i of imports(src)) {
        const target = resolve(file, i.spec);
        const safe = target !== null && Object.keys(CLIENT_SAFE).some((f) => f.replace(/\.tsx?$/, "") === target.replace(/\.tsx?$/, ""));
        if (!i.typeOnly && !safe && inServerDir(target)) report.push(`${file}: imports ${i.spec}`);
      }
    }
    expect(report, `Browser code may import only types from ${SERVER_DIRS.join(", ")} (\`import type\`); call the server through a server action or the reads proxy:\n${report.join("\n")}`).toEqual([]);
  });

  it("keeps the client-safe modules free of server APIs", () => {
    const report = Object.keys(CLIENT_SAFE)
      .filter((f) => fs.existsSync(path.join(root, f)))
      .flatMap((f) => {
        const src = read(f);
        const api = imports(src).find((i) => !i.typeOnly && (SERVER_APIS.test(i.spec) || i.spec === "server-only"));
        return api ? [`${f}: imports ${api.spec}`] : [];
      });
    expect(report, "a client-safe module must not use a server API: split the server part out").toEqual([]);
  });

  it("has no stale exemption", () => {
    const missing = Object.keys(EXEMPT).filter((f) => !fs.existsSync(path.join(root, f)));
    expect(missing, "these exempt files no longer exist: remove them from EXEMPT").toEqual([]);
  });
});
