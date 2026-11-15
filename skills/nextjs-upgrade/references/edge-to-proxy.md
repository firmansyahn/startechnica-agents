# Edge middleware to `proxy.ts`, later

The upgrade keeps edge middleware as `middleware.ts` (`upgrade-edge-middleware-not-proxy`): Next 16 deprecates the file name but still runs it, and `proxy.ts` runs only on Node. Moving it is a separate change, made when the user decides to. This is the checklist for that change.

## 1. Does the runtime change anything here?

- **`next start` on your own servers or Kubernetes:** edge middleware already runs inside the same Node process, in an edge-runtime sandbox. Moving to `proxy.ts` removes the sandbox. It doesn't move the code anywhere, so latency stays the same.
- **A platform that runs middleware at edge locations:** the code moves from close to the user into the app's region. Check the latency of what it does on each request (redirects, rewrites, auth checks) from the regions users are in.

## 2. What the code uses

| In the middleware | On Node (`proxy.ts`) |
|---|---|
| `fetch`, `Request`, `Response`, `URL`, `Headers`, `crypto.subtle`, `TextEncoder`, `atob` | Same: Node has them |
| `NextResponse`, `NextRequest`, cookies, `matcher` | Same |
| Libraries with an edge build (JWT verification such as `jose`, edge database or KV clients) | Usually work on Node too. Check that the import still resolves (some ship separate `edge-light` / `node` entries) |
| Platform-only APIs (edge config stores, request geo or IP helpers) | Replace them with the platform's headers or a Node client, or keep the middleware |
| Size or API limits the edge runtime imposed (no `fs`, no Node built-ins) | Gone. Don't start doing slow work per request just because it is allowed now: the proxy runs on every matched request. |
| `export const config = { runtime: "edge" }` | Delete it: `proxy` has no runtime option |

## 3. The change

1. Run `<dlx> @next/codemod@<v> middleware-to-proxy .`: it renames the file and the exported function to `proxy`. Delete the `runtime` key by hand.
2. Rename the config that names middleware (`skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`).
3. Keep the `matcher` as it is, and check it still excludes `_next/static`, `_next/image`, the probes and public files.
4. **Tests:** the proxy's own tests (redirects, rewrites, gates, headers such as CSP nonces and request ids), then the baseline routes on staging (`upgrade-rollout-with-rollback`).
5. Commit it on its own: `refactor(<scope>): move middleware to proxy on the node runtime`.

## 4. Keep the middleware when

- it relies on a platform-only edge API that has no Node equivalent yet; or
- running at edge locations is part of the design (geo routing, low-latency gates), and the platform doesn't run `proxy` there.

Write the reason in a comment at the top of `middleware.ts` and in the report, so the next upgrade doesn't ask again.
