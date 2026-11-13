# The server logger

## Module

```ts
// src/libs/logger.ts
import "server-only";
import pino, { type Logger } from "pino";
import { headers } from "next/headers";

const REDACT = [
  "*.authorization", "*.cookie", "*.password", "*.secret", "*.token", "*.access", "*.refresh",
  "*.code", "*.client_secret", "*.apiKey",
  'req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]',
];

function build(): Logger {
  const dev = process.env.NODE_ENV === "development";
  return pino({
    level: process.env.LOG_LEVEL ?? (dev ? "debug" : "info"),
    base: { "service.name": process.env.SERVICE_NAME ?? "web" },
    messageKey: "message",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ "log.level": label }) },
    redact: { paths: REDACT, censor: "[redacted]" },
    transport: dev ? { target: "pino-pretty", options: { colorize: true } } : undefined,
  });
}

const g = globalThis as unknown as { __logger?: Logger };
export const logger: Logger = (g.__logger ??= build());   // one instance across dev hot reloads

/** A child logger carrying the current request's id; use in route handlers, actions and server components. */
export async function requestLogger(bindings: Record<string, unknown> = {}): Promise<Logger> {
  const id = (await headers()).get("x-request-id") ?? undefined;
  return logger.child({ "http.request.id": id, ...bindings });
}
```

- Field names above follow ECS (`log.level`, `service.name`, `http.request.id`, `message`); use the OpenTelemetry names instead if the backend does. Pick one and keep it.
- `redact` paths are explicit: pino's wildcard `*` matches one level. Log objects shaped so secrets sit at a known depth, or redact before logging (`safeHeaders(h)` that keeps an allow-list).
- Runtime config (`LOG_LEVEL`, `SERVICE_NAME`) is read when the process starts, never baked into the build.
- Next 16's `proxy.ts` runs on the Node.js runtime, so the logger works there too; code on the Edge runtime can't load pino and writes `console.log(JSON.stringify({...}))` in the same shape.

## Request ids

```ts
// proxy.ts
const id = request.headers.get("x-request-id") ?? crypto.randomUUID();
const headers = new Headers(request.headers);
headers.set("x-request-id", id);
const res = NextResponse.next({ request: { headers } });   // or the rewrite to the backend
res.headers.set("x-request-id", id);                       // the browser can show it
return res;
```

- Accept an incoming id only from a trusted ingress (it sets one), or validate its shape (UUID, ≤ 64 safe chars) before using it.
- The BFF forwards it on every backend call; the backend logs the same id.

## What a backend-call line looks like

```ts
const started = performance.now();
const res = await callBackend(...);
log.info({ "http.request.method": method, "url.path": routeTemplate, "http.response.status_code": res.status,
  "event.duration": Math.round((performance.now() - started) * 1e6) }, "backend call");   // ECS duration is nanoseconds
```

Log the **route template** (`/items/:id`) or the path without query string, never the query (it may hold codes, tokens or search terms). Use `debug` for successful calls if the ingress already logs requests, `warn` for 5xx and timeouts.

## OpenTelemetry

- `instrumentation.ts` `register()` starts tracing (`@vercel/otel` `registerOTel("web")`, or `@opentelemetry/sdk-node` with an OTLP exporter).
- Put the active trace and span ids on every log line with a pino `mixin`:

```ts
import { trace } from "@opentelemetry/api";
mixin() {
  const span = trace.getActiveSpan()?.spanContext();
  return span ? { "trace.id": span.traceId, "span.id": span.spanId } : {};
},
```

- Propagate `traceparent` to the backend with the request id, so one trace spans both.

## Personal data

- Prefer ids over values (`account.id`, not the email).
- When a value is needed for support, mask it (`a***@example.com`, last 4 digits of a phone).
- Never log form inputs, request bodies, or full replies.

## Tests

```ts
it("redacts credentials", () => {
  const lines: string[] = [];
  const log = pino({ redact: { paths: REDACT, censor: "[redacted]" } }, { write: (l: string) => lines.push(l) });
  log.info({ req: { headers: { authorization: "Bearer abc", cookie: "s=1" } }, body: { password: "p" } }, "x");
  expect(lines.join("")).not.toMatch(/abc|s=1|"p"/);
});
```

- Export `REDACT` (or a `createLogger(stream)` factory) so the test uses the real configuration.
- Tests run with `LOG_LEVEL=silent` unless a test captures output on purpose.
