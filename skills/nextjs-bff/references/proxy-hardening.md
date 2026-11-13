# BFF proxy hardening

Every rule here exists because the proxy route turns a cookie the browser sends automatically into a bearer token the backend trusts. Treat it as an authentication boundary.

## Path mapping

```ts
const ROOT = "/api/v1/console/";           // backend root for this surface
const BROWSER_ROOT = "/admin/api/";        // what the browser calls
const NAMESPACES = ["accounts", "billing", "users"] as const;   // allow-listed first segments

export function backendPathFor(rawPathname: string): string | null {
  if (!rawPathname.startsWith(BROWSER_ROOT)) return null;
  const rest = rawPathname.slice(BROWSER_ROOT.length);
  if (rest === "" || /[\\\u0000-\u001f\u007f]/.test(rest)) return null;
  if (/%(2e|2f|5c|25|00)/i.test(rest)) return null;                 // encoded . / \ % NUL
  const segments = rest.split("/");
  if (segments.some((s, i) => (s === "" && i !== segments.length - 1) || s === "." || s === "..")) return null;
  if (!(NAMESPACES as readonly string[]).includes(segments[0])) return null;
  return ROOT + rest;
}
```

- Use the **raw** pathname as received (`new URL(req.url).pathname`), never a decoded one: decoding first lets `%2e%2e` or `%2f` reach another backend route.
- Keep the namespace list in one module and test it against the backend's route list, so a new backend area is a deliberate addition.
- Server actions build paths from parts: `encodeURIComponent` each id and refuse a segment that decodes to `/`, `\`, `.`, `..` or a control character.

## Headers

- **Request, allow-list:** `accept`, `accept-language`, `content-type`, `content-length` (for a streamed body), `if-none-match`, `if-match`, the scope header (`tenant-id`, `workspace-id`), `x-request-id`. Add `authorization: Bearer <access>`. Drop everything else, `cookie` first.
- **Reply, deny-list:** `set-cookie`, `connection`, `keep-alive`, `transfer-encoding`, `upgrade`, `proxy-*`, `www-authenticate` (the browser must not see bearer challenges). Add `cache-control: no-store` to anything carrying user data.

## Cross-site requests

- Require a custom request header that the app's own fetch wrapper always sends. A cross-site page can only send it after a CORS preflight, which the proxy never grants (no `Access-Control-Allow-*` replies).
- When `Sec-Fetch-Site` is present it must be `same-origin`.
- `SameSite=Strict` on the session cookie is a second layer, not the only one.

## Methods

- `GET`/`HEAD` forwarded. Everything else answers 405 with `Allow: GET, HEAD`, except an explicit upload allow-list (`POST` to named paths) whose bodies are streamed (`duplex: "half"`).
- Writes belong to server actions: Next's own Origin check, zod validation and the `Result` contract apply there.

## Errors

- Backend unreachable or timed out → 503 with the standard envelope; no stack traces, no backend URL in the message.
- Session missing or refresh refused → 401 with a cleared session cookie.
- Reply fails the OpenAPI check → 502 naming the operation and field outside production; in production, pass the reply through and log the mismatch.

## Logging

- Log method, raw path, backend status, duration and request id. Never log cookies, tokens, `Authorization`, request bodies of auth endpoints, or reply bodies.

## Tests to keep

- Each refused path spelling (`..`, `%2e%2e`, `%2f`, `\`, double encoding, unknown namespace) answers 404 without a backend call.
- A request without the custom header, or with `Sec-Fetch-Site: cross-site`, answers 403.
- A write method answers 405 unless allow-listed.
- A guard 401 triggers one refresh and one retry; a second 401 ends the session; a handler 401 (no `WWW-Authenticate: Bearer`) is passed through.
- Two concurrent requests near expiry cause one refresh.
- No reply ever carries `Set-Cookie` from the backend.
