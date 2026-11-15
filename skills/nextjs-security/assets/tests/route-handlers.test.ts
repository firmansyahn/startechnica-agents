import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Rule sec-route-handler-auth-origin: every route handler checks the session itself (proxy.ts
// gating is a convenience), every POST/PUT/PATCH/DELETE export checks the origin, and a GET never
// changes state. A source-text test: it reads each app/**/route.* and looks for the project's
// helper calls. Place this file in <app-root>/tests/; root then resolves to the app.
// Misses: whether the handler checks the caller's right to the resource (ownership is checked in
// the data layer, sec-data-layer-checks-caller), a check made in a helper the handler calls but
// whose name isn't listed below, and a write in a GET made through a helper the GET calls.
const root = path.resolve(__dirname, "..");

// ADJUST: the folders holding the routes, and the calls that count as the checks. A wrapper that
// does the check (withSession(handler)) belongs in the same pattern.
const ROUTE_DIRS = ["app", "src/app"];
const SESSION_CHECK = /\b(?:requireSession|withSession)\s*\(/;
const ORIGIN_CHECK = /\b(?:sameSite|withSession)\s*\(/;
// Writes a GET must not make: sign-out, cookies set or deleted, a database write.
const GET_WRITES = /\bsignOut\s*\(|\bcookies\(\)\)?\s*\.\s*(?:set|delete)\s*\(|\b(?:db|prisma|tx)\s*\.\s*\w+\s*\.\s*(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;

// Deliberate exceptions, each with the reason. Every entry must still exist (the last test fails
// on a stale one), so the lists only shrink.
// Routes anyone may call without a session.
const PUBLIC: Record<string, string> = {
  // The nextjs-deploy probes: the kubelet calls them without a session, and they answer no data.
  "app/livez/route.ts": "liveness probe, answers no data",
  "app/readyz/route.ts": "readiness probe, answers no data",
  // "app/auth/callback/route.ts": "the OAuth callback creates the session; state and PKCE are checked (oauth-client)",
  // "app/api/csp-report/route.ts": "browsers post CSP reports without credentials; rate-limited and size-capped",
};
// Write exports that skip the origin check.
const NO_ORIGIN: Record<string, string> = {
  // "app/api/csp-report/route.ts": "report posts carry no Sec-Fetch-Site same-origin; the handler only logs",
  // "app/api/webhooks/billing/route.ts": "server-to-server; the signature header is verified instead",
};
// GETs that change state on purpose.
const GET_WRITE_ALLOWED: Record<string, string> = {
  // "app/auth/callback/route.ts": "the OAuth redirect lands as a GET and sets the session cookie",
};
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", "coverage"]);
const WRITES = ["POST", "PUT", "PATCH", "DELETE"];

function routes(dir: string): string[] {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : routes(rel);
    return /^route\.[jt]sx?$/.test(entry.name) ? [rel] : [];
  });
}

// The source without comments, so a commented-out check doesn't count (a "//" after ":" is a URL).
const uncomment = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const read = (rel: string) => uncomment(fs.readFileSync(path.join(root, rel), "utf8"));

/** The HTTP methods a route module exports, with the source of each handler (up to the next top-level export). */
function handlers(source: string): Map<string, string> {
  const found = new Map<string, string>();
  const starts = [...source.matchAll(/^export\s+(?:async\s+function\s+|function\s+|(?:const|let)\s+)(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/gm)];
  const tops = [...source.matchAll(/^export\s/gm)].map((m) => m.index!);
  for (const m of starts) {
    const next = tops.find((i) => i > m.index!) ?? source.length;
    found.set(m[1], source.slice(m.index!, next));
  }
  // export { handler as GET, handler as POST }: the whole module is the handler's source.
  for (const block of source.matchAll(/^export\s*\{([^}]*)\}/gm))
    for (const m of block[1].matchAll(/\bas\s+(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/g)) found.set(m[1], source);
  return found;
}

const files = ROUTE_DIRS.flatMap(routes);

describe("route handlers check the session and the origin, and GET never writes (rule sec-route-handler-auth-origin)", () => {
  it("finds the exported methods and their source", () => {
    const src = `import { x } from "y";\nexport async function GET(req: Request) { return a; }\nexport const POST = withSession(async () => b);\nconst h = () => c;\nexport { h as DELETE };`;
    const found = handlers(src);
    expect([...found.keys()].sort()).toEqual(["DELETE", "GET", "POST"]);
    expect(found.get("GET")).toContain("return a");
    expect(found.get("GET")).not.toContain("withSession");
    expect(uncomment(`// requireSession(req)\nconst u = "https://example.com"; /* sameSite(req) */`)).toBe(`\nconst u = "https://example.com"; ${" ".repeat(19)}`);
  });

  it("checks the session in every route handler", () => {
    const report = files
      .filter((f) => !(f in PUBLIC) && handlers(read(f)).size > 0 && !SESSION_CHECK.test(read(f)))
      .map((f) => `${f}: no session check`);
    expect(report, `Check the session in the handler before any data access (const session = await requireSession(req); if (!session) return 401), or add the route to PUBLIC with the reason:\n${report.join("\n")}`).toEqual([]);
  });

  it("checks the origin in every POST, PUT, PATCH and DELETE export", () => {
    const report: string[] = [];
    for (const f of files) {
      if (f in NO_ORIGIN) continue;
      for (const [method, body] of handlers(read(f)))
        if (WRITES.includes(method) && !ORIGIN_CHECK.test(body)) report.push(`${f}: ${method} has no origin check`);
    }
    expect(report, `Refuse cross-site writes first (if (!sameSite(req)) return 403: Sec-Fetch-Site same-origin, or Origin equal to the public origin), or add the route to NO_ORIGIN with the reason:\n${report.join("\n")}`).toEqual([]);
  });

  it("makes no write in a GET handler", () => {
    const report: string[] = [];
    for (const f of files) {
      if (f in GET_WRITE_ALLOWED) continue;
      const get = handlers(read(f)).get("GET");
      const hit = get?.match(GET_WRITES);
      if (hit) report.push(`${f}: GET calls ${hit[0].replace(/\s+/g, "")}`);
    }
    expect(report, `Links, prefetches and image tags send GETs cross-site: move the write (sign-out included) to a POST that checks the origin, or add the route to GET_WRITE_ALLOWED with the reason:\n${report.join("\n")}`).toEqual([]);
  });

  it("has no stale exception", () => {
    const stale = [PUBLIC, NO_ORIGIN, GET_WRITE_ALLOWED].flatMap((list) => Object.keys(list)).filter((f) => !files.includes(f));
    expect(stale, "these exceptions name no route file any more: remove them").toEqual([]);
  });
});
