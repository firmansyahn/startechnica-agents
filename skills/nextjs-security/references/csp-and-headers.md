# CSP and security headers

Verified against Next 16's `content-security-policy.md` and `next-config-js/headers.md`; re-check the installed version's copies in `node_modules/next/dist/docs/`.

## Choose the CSP mode

| Mode | Pages | Use when |
|---|---|---|
| **Nonce** (recommended for signed-in apps) | Every page renders dynamically (a nonce per request) | Consoles, dashboards, anything behind sign-in: they are dynamic anyway |
| **SRI** (`experimental.sri`) | Pages stay static; scripts carry build-time `integrity` hashes | Public, cacheable sites that still want no `'unsafe-inline'`. Experimental: pin the Next version and re-test on upgrade |
| **Static policy** in `next.config` `headers()` with `'unsafe-inline'` for scripts | Static | Only as a first step; it doesn't stop injected inline scripts |

Nonces need **dynamic rendering**: static generation, ISR, CDN caching of HTML and Partial Prerendering don't work with them (the static shell has no nonce). A page that would otherwise be static opts in with `await connection()` (`next/server`).

## Nonce CSP in `proxy.ts`

One `proxy.ts` does everything request-level: the BFF's rewrites and page gating (`nextjs-bff` section 6) and the CSP. Compose them; never two files or two matchers that disagree.

```ts
// proxy.ts
import { NextResponse, type NextRequest } from "next/server";

function csp(nonce: string) {
  const dev = process.env.NODE_ENV === "development";
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,                 // see "Styles" below
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'`,                                // add the error-reporting / analytics origins you use
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

export function proxy(request: NextRequest) {
  // ... the BFF's rewrites and gating first; return early for those ...
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);   // Next reads the nonce from here while rendering
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
```

- Next extracts the nonce from the **request's** `Content-Security-Policy` header and adds it to its framework scripts, page bundles and its own inline scripts. You add it only to your own `<Script>` tags and inline scripts: `const nonce = (await headers()).get("x-nonce")`.
- `'strict-dynamic'` lets scripts loaded by a nonced script run, so host allow-lists in `script-src` are ignored by modern browsers; keep `'self'` for old ones.
- Development needs `'unsafe-eval'` (React rebuilds server error stacks with `eval`); production doesn't.
- The matcher must stay a static literal and stay in step with the BFF's prefix list; a test can compare them.

## Inline scripts that must run before paint (theme)

| Theme mechanism (`nextjs-ui`) | How it passes the CSP |
|---|---|
| A/B: next-themes | Pass the nonce: `<ThemeProvider nonce={nonce}>` in the root layout (read with `headers()`); check the installed next-themes version has the prop |
| C: server-painted cookie plus one constant script | Either the nonce (`<script nonce={nonce} dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} />`) or, when pages must stay static, its hash: add `'sha256-<base64 of MODE_SCRIPT>'` to `script-src`, computed by a test from the constant so they never drift |

Never add `'unsafe-inline'` to `script-src` for one script; with a nonce or hash present, browsers ignore it anyway, so it only weakens old browsers.

## Third-party scripts

- Load them with `next/script` and the nonce; with `'strict-dynamic'` what they load runs too, so add a third party only if you'd trust all of its code.
- Their API calls need `connect-src`, their images `img-src`, their frames `frame-src`: add exact origins, not wildcards.
- Prefer self-hosting (fonts through `next/font`, which serves them from `'self'`).

## Styles

A nonce in `style-src` blocks the `style="…"` attributes in server-rendered HTML and `<style>` tags libraries inject at runtime (positioning engines, toasters, chart libraries), and those break in subtle ways. The pragmatic default is `style-src 'self' 'unsafe-inline'`: style injection is far less dangerous than script injection when scripts are locked down. Tighten to nonces only after a full visual pass of every page in a real browser with the policy enforced.

## Roll out without breaking pages

1. Ship the policy as `Content-Security-Policy-Report-Only` with a `report-to` group (plus the older `report-uri`) pointing at a route handler that logs reports (rate-limited, body size capped, no echo).
2. Browse every page (the e2e suite and the screenshot script do most of it), read the reports, fix the sources: inline handlers (`onclick=` in HTML), `javascript:` URLs, missing origins.
3. Switch to enforcing `Content-Security-Policy`; keep the reporting.

## The other headers

Static headers go in `next.config` `headers()` (they don't depend on the request); the CSP stays in `proxy.ts`.

```ts
// next.config.ts
const security = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },                      // old browsers; CSP frame-ancestors for new
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: security }];
  },
};
```

- **HSTS** only once every host under the domain serves HTTPS; `includeSubDomains` and `preload` are hard to undo. If the ingress already sets it, don't set it twice with different values.
- **Permissions-Policy:** turn off what the app doesn't use; allow a feature for `self` only where a page needs it (`camera=(self)`).
- **COOP `same-origin`** breaks OAuth or payment pop-ups that talk back through `window.opener`; use `same-origin-allow-popups` there.
- **CORP `same-origin`** blocks other sites from embedding your images and files; loosen it per path for assets meant to be embedded.
- The BFF's reads proxy and route handlers answer JSON: they still get `nosniff` and `Cache-Control: no-store` for anything user-specific.

## Test it

- A unit test of `csp()` (directives present, no `'unsafe-inline'` in `script-src` outside dev, nonce changes per call).
- A browser test that loads a real page and asserts the response headers, and that the page logs no CSP violation (`page.on("console")` for "Content Security Policy") (`nextjs-e2e`).
