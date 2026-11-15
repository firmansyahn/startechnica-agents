import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Rule log-client-endpoint-limited: the route handler that receives browser error reports caps the
// body size (413), validates it with a schema (400), rate-limits per client (429), and logs a valid
// report once at `error` with "event.origin": "browser". It calls the real handler with requests
// built here; the logger is replaced by a recorder. Place this file in <app-root>/tests/.
// Misses: limits enforced only at the edge (ingress, CDN) are invisible here, and so is a limiter
// whose store is per process when the app runs several replicas (sec-rate-limit-endpoints).

// ADJUST: the route module, relative to this file, and the URL it answers on.
const ROUTE = "../app/api/client-errors/route";
const ENDPOINT = "http://localhost/api/client-errors";
// ADJUST: the endpoint's settings: the body cap in bytes and the reports one client may send per window.
const MAX_BYTES = 16 * 1024;
const LIMIT = 10;
// ADJUST: a report the schema accepts, and one it refuses.
const VALID = { message: "TypeError: x is undefined", stack: "at f (app.js:1:1)", digest: "3141592653", route: "/items" };
const INVALID = { message: 42, stack: ["not", "a", "string"] };
// ADJUST: the request headers that identify one client the way the limiter keys it: the address
// header the trusted proxy sets (sec-client-ip-from-trusted-proxy), or the session cookie.
const client = (n: number): Record<string, string> => ({ "x-real-ip": `203.0.113.${n}` });
// ADJUST: empty the limiter's store between tests (export a reset from the limiter, or point it at
// a fresh in-memory store under test).
async function resetLimiter(): Promise<void> {
  const limiter = await import("../src/libs/rate-limit");
  limiter.resetRateLimits();
}

interface Line {
  level: string;
  fields: Record<string, unknown>;
  message?: string;
}
const lines = vi.hoisted(() => [] as Line[]);

// The logger module imports "server-only", which throws outside a React Server bundle.
vi.mock("server-only", () => ({}));
// ADJUST: the logger module's specifier, as the route imports it. A route that reads next/headers
// itself (cookies() for the session) needs that module mocked the same way.
vi.mock("@/libs/logger", () => {
  type Fields = Record<string, unknown>;
  const make = (bindings: Fields): Record<string, unknown> => {
    const at = (level: string) => (a?: Fields | string, b?: string) => {
      const [fields, message] = typeof a === "string" ? [{}, a] : [a ?? {}, b];
      lines.push({ level, fields: { ...bindings, ...fields }, message });
    };
    return {
      trace: at("trace"), debug: at("debug"), info: at("info"), warn: at("warn"), error: at("error"), fatal: at("fatal"),
      child: (more: Fields) => make({ ...bindings, ...more }),
    };
  };
  const logger = make({});
  return { logger, requestLogger: async (b: Fields = {}) => make(b), createLogger: () => logger };
});

type Handler = (req: NextRequest) => Promise<Response> | Response;
const route = async (): Promise<Handler> => {
  const mod = (await import(ROUTE)) as { POST?: Handler };
  if (!mod.POST) throw new Error(`${ROUTE} exports no POST handler`);
  return mod.POST;
};
const post = async (body: string, headers: Record<string, string>) =>
  (await route())(new NextRequest(ENDPOINT, { method: "POST", body, headers: { "content-type": "application/json", ...headers } }));
const browserErrors = () => lines.filter((l) => l.level === "error" && l.fields["event.origin"] === "browser");

describe("the client-error endpoint is validated and rate-limited (rule log-client-endpoint-limited)", () => {
  beforeEach(async () => {
    lines.length = 0;
    await resetLimiter();
  });

  it("logs a valid report once, at error, with event.origin browser", async () => {
    const res = await post(JSON.stringify(VALID), client(1));
    expect(res.status, `a valid report must be accepted (2xx), got ${res.status}`).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    expect(browserErrors(), `log the report once: log.error({ ..., "event.origin": "browser" }, "client error"). Lines:\n${JSON.stringify(lines, null, 2)}`).toHaveLength(1);
  });

  it("answers 413 to a body over the cap, with and without a Content-Length header", async () => {
    const big = JSON.stringify({ ...VALID, stack: "x".repeat(Math.max(MAX_BYTES * 2, 1024 * 1024)) });
    const declared = await post(big, { ...client(2), "content-length": String(Buffer.byteLength(big)) });
    expect(declared.status, "check Content-Length before reading the body").toBe(413);
    const undeclared = await post(big, client(3));
    expect(undeclared.status, "cap the bytes read from the stream too: Content-Length can be absent or wrong").toBe(413);
    expect(browserErrors(), "an oversized report must not be logged").toHaveLength(0);
  });

  it("answers 400 to a body that fails the schema or isn't JSON", async () => {
    expect((await post(JSON.stringify(INVALID), client(4))).status, "parse the body with the schema (safeParse) and answer 400").toBe(400);
    expect((await post("{not json", client(5))).status, "a body that isn't JSON is a 400, not a 500").toBe(400);
    expect(browserErrors(), "a refused report must not be logged at error").toHaveLength(0);
  });

  it(`answers 429 to report ${LIMIT + 1} from one client`, async () => {
    for (let i = 1; i <= LIMIT; i++) {
      const res = await post(JSON.stringify(VALID), client(6));
      expect(res.status, `report ${i} of ${LIMIT} must be accepted`).toBeLessThan(300);
    }
    const over = await post(JSON.stringify(VALID), client(6));
    expect(over.status, `rate-limit per client: report ${LIMIT + 1} within the window must answer 429`).toBe(429);
    expect(browserErrors(), `each of the ${LIMIT} accepted reports is logged once at error, the refused one not at all`).toHaveLength(LIMIT);
    expect((await post(JSON.stringify(VALID), client(7))).status, "the limit is per client, not global").toBeLessThan(300);
  });
});
