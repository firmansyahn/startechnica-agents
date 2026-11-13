# Requests: route handlers, redirects, server fetches, uploads, rate limits

## Route handlers: authentication and CSRF

Server actions get Next's origin check and POST-only dispatch; **route handlers get neither**. Each handler does its own:

```ts
// app/<area>/api/export/route.ts
import "server-only";

export async function POST(request: Request) {
  if (!sameSite(request)) return new Response(null, { status: 403 });
  const session = await requireSession(request);            // 401 when signed out
  if (!session) return new Response(null, { status: 401 });
  // authorize for this resource, parse the body with zod, then act
}

function sameSite(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  return origin !== null && origin === publicOrigin();      // from configuration, not from Host
}
```

- **No state change on `GET`/`HEAD`.** Links, prefetches and image tags fire GETs cross-site.
- **State-changing handlers check origin** (`Sec-Fetch-Site`, else `Origin` against the configured public origin) and, for JSON APIs, require a custom header or `Content-Type: application/json` (a cross-site form can't send either without a preflight you never grant). `SameSite=Strict` cookies are a second layer, not the only one.
- **Authenticate and authorize in the handler.** `proxy.ts` gating is a convenience (a request can reach a handler without passing the gate you expect); every handler checks the session and the resource.
- **No CORS unless the endpoint is a public API.** Never reflect `Origin` into `Access-Control-Allow-Origin` with credentials.
- **Parse input with zod**, cap body size (`request.body` streamed with a byte counter, or check `Content-Length` and still count).
- Webhooks from third parties verify the provider's signature over the raw body with a constant-time compare, check a timestamp window, and are idempotent.

## Redirects

Every redirect whose target comes from the request (`?next=`, `?returnTo=`, a form field, a header) goes through one check: a relative path starting with a single `/`, no `//`, no `\`, no scheme, no control characters, and not a sign-in/out route. Anything else falls back to the default page. The same helper serves sign-in (`oauth-client`), `redirect()` in actions and route handlers, and `proxy.ts`. Review ID: `sec-safe-redirect-next`.

Public URLs (for links in emails, OAuth `redirect_uri`, absolute redirects) come from configuration, never from `Host` or `X-Forwarded-Host`.

## Server-side fetches to URLs users supply (SSRF)

Webhook targets, link previews, "import from URL", avatar URLs and image proxies make the Next server fetch where a user points it, from inside your network.

- **Allow-list** the hosts (or host suffixes) the feature needs; refuse everything else before resolving.
- If an open set is unavoidable: allow only `https:` (and `http:` only if needed), resolve the name, refuse private, loopback, link-local, metadata and unique-local ranges (IPv4 and IPv6, including IPv4-mapped), and connect to the address you checked (pin it) so DNS rebinding can't swap it.
- **Don't follow redirects** automatically (`redirect: "manual"`), or re-run the checks on each hop.
- Timeouts (`AbortSignal.timeout(5_000)`), a response size cap, and no forwarding of the user's cookies or tokens.
- `next/image`: keep `images.remotePatterns` to exact hosts and paths; never `hostname: "**"`.

## File uploads

Uploads go through a route handler, not a server action (`nextjs-data`).

- **Cap size while streaming** and abort past the limit; don't buffer an unbounded body first.
- **Check the type by content** (magic bytes) against an allow-list for the feature; the browser's `Content-Type` and the extension are hints only. Re-encode images when you can (strips metadata and payloads).
- **SVG and HTML are active content.** Refuse them, or sanitise them and always serve them as downloads.
- **Store under a random key** in object storage or a folder outside `public/`; never use the user's file name as a path. Keep the original name only as metadata.
- **Serve** through a handler that authorizes the reader, with `Content-Disposition: attachment` (or `inline` only for re-encoded images), the stored `Content-Type`, `X-Content-Type-Options: nosniff` and `Cache-Control: private`; better still from a separate cookie-less origin.
- Scan with an antivirus service where the files are passed on to other users.

## Rate limits

Put limits where Next sits in front of something expensive or guessable: sign-in and callback routes, password reset and invitations, uploads, search and export, the CSP report endpoint.

- Prefer the edge (ingress, gateway, WAF) for per-IP limits; it sheds load before Node renders anything.
- In-app limits use the shared store (Redis/Valkey, the one the BFF uses) so every replica counts together: a fixed-window or token-bucket counter keyed by session id, account or IP.
- The client IP comes from the trusted proxy's header with a configured hop count, never the left-most `X-Forwarded-For` value a client can set.
- Answer `429` with `Retry-After`; log the key (hashed), not the request body.
- The backend still enforces its own limits; the BFF's are about protecting itself and the sign-in flow.
