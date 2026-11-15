import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rule page-central-access-map: every page has an entry in the one route -> permission map. The test
// lists the routes of app/**/page.tsx (route groups and @slots dropped, `[id]` as a parameter), imports
// the map and fails on a route it doesn't cover. Place this file in <app-root>/tests/; root then
// resolves to the app.
//
// What it can't see: whether the backend route declares the same permission (review, or the API
// contract test), whether the shell or proxy.ts really enforces the map, and pages that check roles
// themselves (`scripts/scan.sh` lists `.role ===` and `roles.includes(` candidates).
const root = path.resolve(__dirname, "..");

// The map's module (relative to root) and export. The test imports it in node, so keep the map in a
// module without `import "server-only"` or Next request APIs (proxy.ts and the shell import it).
const ACCESS_MAP_MODULE = "src/configs/access.ts";
const ACCESS_MAP_EXPORT = "ACCESS_MAP";
// The map's entries as paths: an array of { path } (or { pattern }), or an object keyed by path.
function entryPaths(map: unknown): string[] {
  if (Array.isArray(map)) return map.map((e) => (typeof e === "string" ? e : (e.path ?? e.pattern))).filter((p): p is string => typeof p === "string");
  return map && typeof map === "object" ? Object.keys(map) : [];
}
// Whether an entry covers a route. Exact by default; a map that grants whole sections by prefix
// replaces this with: route === entry || route.startsWith(`${entry}/`).
const covers = (entry: string, route: string) => entry === route;
// URL segments dropped besides (groups) and @slots, e.g. "[locale]" with next-intl routing.
const DROP_SEGMENTS = new Set<string>([]);
// Routes that need no entry, each with its reason (the sign-in page, a public status page). It only
// shrinks: an entry that is covered by the map now, or whose page is gone, fails the stale test.
const PUBLIC: Record<string, string> = {
  // "/login": "the sign-in page is open to everyone",
};
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", "coverage"]);

function pages(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) || entry.name.startsWith("_") ? [] : pages(rel);
    return /^page\.[jt]sx?$/.test(entry.name) ? [rel] : [];
  });
}

/** A page file's URL: "/admin/items/:param", or null for an intercepting route (it shows another route). */
function route(file: string): string | null {
  const segments = file.split("/").slice(1, -1);
  if (segments.some((s) => /^\(\.{1,3}\)/.test(s))) return null;
  const kept = segments.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith("@") && !DROP_SEGMENTS.has(s));
  return `/${kept.map((s) => (/^\[/.test(s) ? ":param" : s)).join("/")}`;
}

/** An entry's path with every parameter spelled the same way (`[id]`, `:id`, `:slug*`, `*` -> `:param`). */
const normalise = (p: string) =>
  (p.replace(/\/+$/, "") || "/").replace(/\[\[?\.{0,3}[^\]]+\]\]?|:[\w]+[*+?]?|\*/g, ":param");

describe("every page has an access entry (rule page-central-access-map)", () => {
  it("turns page files into routes and spells parameters one way", () => {
    expect(route("app/(admin)/admin/items/[id]/page.tsx")).toBe("/admin/items/:param");
    expect(route("app/@modal/(.)items/[id]/page.tsx")).toBe(null);
    expect(route("app/page.tsx")).toBe("/");
    expect(normalise("/admin/items/:id/")).toBe("/admin/items/:param");
    expect(normalise("/docs/[...slug]")).toBe("/docs/:param");
  });

  const routes = [...new Set(pages("app").map(route).filter((r): r is string => r !== null))];

  it("covers every route", async () => {
    const file = path.join(root, ACCESS_MAP_MODULE);
    expect(fs.existsSync(file), `no ${ACCESS_MAP_MODULE}: set ACCESS_MAP_MODULE to the route -> permission map's module`).toBe(true);
    const mod = await import(/* @vite-ignore */ file);
    const entries = entryPaths(mod[ACCESS_MAP_EXPORT]).map(normalise);
    expect(entries.length, `${ACCESS_MAP_MODULE} exports no ${ACCESS_MAP_EXPORT} entries: set ACCESS_MAP_MODULE and ACCESS_MAP_EXPORT`).toBeGreaterThan(0);
    const missing = routes.filter((r) => !(r in PUBLIC) && !entries.some((e) => covers(e, r)));
    expect(missing, `Add an entry (path and permission) to ${ACCESS_MAP_MODULE} for each route, or a PUBLIC entry with its reason:\n${missing.join("\n")}`).toEqual([]);

    const stale = Object.keys(PUBLIC).filter((r) => !routes.includes(r) || entries.some((e) => covers(e, r)));
    expect(stale, "these routes are gone or in the map now: remove them from PUBLIC").toEqual([]);
  });
});
