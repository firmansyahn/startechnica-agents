# Errors and reporting

## Uncaught server errors: `instrumentation.ts`

```ts
// instrumentation.ts (app root, or src/ when the app uses a src folder for app code)
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./src/libs/otel");          // optional tracing setup
  }
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logger } = await import("@/libs/logger");
  const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : undefined;
  logger.error(
    {
      err,
      digest,
      "http.request.method": request.method,
      "url.path": request.path.split("?")[0],
      "http.request.id": [request.headers["x-request-id"]].flat()[0],
      "next.route": context.routePath,
      "next.route_type": context.routeType,        // render | route | action | proxy
    },
    "request failed",
  );
};
```

- Covers Server Components, route handlers, server actions and the proxy; you don't need try/catch-and-log around them for unexpected errors.
- Await async reporting inside it (an error tracker's `captureException` then `flush`).
- Strip the query string from `request.path`; never log `request.headers` wholesale.
- The `err` may be a processed copy for Server Component errors; the `digest` ties it to what the user saw.

## Expected failures are not errors

A refused write (422, 403, 409) is a `Result`, shown to the user and logged at most at `warn` in the shared helper. A backend that's down is `warn` with the status. Only bugs and broken invariants are `error`.

## Error pages: show the digest

```tsx
// app/<area>/error.tsx
"use client";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title={t("somethingWentWrong")}
      reference={error.digest}            // "Reference: 3141592653" so support can search the logs
      onRetry={reset}
    />
  );
}
```

- `app/global-error.tsx` covers the root layout (renders its own `<html>` and `<body>`).
- Production hides server error messages from the client; show the digest, never `error.message` from a server error.
- Don't log from `error.tsx` itself for server errors (already logged by `onRequestError`); do report client-side render errors (below).

## Browser errors

Pick one:

- **An error tracker** (Sentry, Grafana Faro, ...): initialise it in `instrumentation-client.ts` (runs before the app's code in the browser), with PII scrubbing on, the release set to the build id, and source maps uploaded at build time but not served publicly.
- **The app's own endpoint:** a small reporter posts `{ message, stack, digest, route, buildId, requestId }` to a route handler (`/<area>/api/client-errors`), which validates and size-limits the body, rate-limits per session/IP, and logs it at `error` with `"event.origin": "browser"`.

Report from: `error.tsx` boundaries for client-side render errors (`useEffect(() => report(error), [error])`), `window.onerror` / `unhandledrejection` once at the root, and failed mutations only when they're unexpected (5xx, network), not every refusal.

Never report form values, tokens or full URLs with query strings.

## Console

- ESLint `no-console: "error"` for `app/`, `components/`, `src/`; allow it in `scripts/`, config files and tests.
- In development, logging a value to the browser console while debugging is fine; it doesn't get committed (the lint rule stops it).

## Tests

- `onRequestError` logs digest, route and route type, without query string or headers.
- The client-error endpoint refuses oversized or malformed bodies and rate-limits.
- An `error.tsx` shows the digest and calls the reporter once.
