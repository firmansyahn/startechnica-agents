---
name: nextjs-bff
description: "Use when building, reviewing or debugging a Backend-for-Frontend in a Next.js app: the browser holds only an opaque session cookie while the Next server keeps the OAuth tokens, proxies reads to a backend API through a route handler, and sends writes through server actions; covers the session store (Redis), token refresh with a lock, the proxy route's hardening, proxy.ts rewrites and page gating, reply validation against OpenAPI, the Result envelope, request ids, and runtime config for one image in every environment."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.2.0"
---

# Next.js as a Backend-for-Frontend

**Principle:** The browser holds only an opaque session cookie; tokens, backend URLs and backend errors stay on the Next server, and the backend stays the authority on access.

The browser never sees an access or refresh token. It holds one opaque, `HttpOnly` session cookie; the Next server maps that cookie to the user's tokens in a server-side store and calls the backend API with them. Reads go through one proxy route handler, writes through server actions, and both share one forwarding path.

```
browser ── cookie ──► Next: /<area>/api/<path> (route handler, reads)  ─┐
                       Next: server action (writes)                     ├─► forwardAs(session) ─► backend /api/...
                       Next: /<area>/authorize, /callback (sign-in)   ─┘     (Bearer access token, refreshed)
```

Related: `oauth-client` ([references/web-bff-client.md](../oauth-client/references/web-bff-client.md): the protocol this server runs as a confidential client, the authorization request and callback, the refresh grant and rotation, sign-out and its tests; this skill doesn't repeat them), `nextjs-logging` (request ids, what the proxy and actions log), `nextjs-data` (the queries that read through the proxy and the actions that write through `apiAction`), `nextjs-app-structure` (where `src/api/` sits). Hardening details: [references/proxy-hardening.md](references/proxy-hardening.md).

## Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### Session and tokens

| ID | Rule | Impact | Check |
|---|---|---|---|
| [sec-no-tokens-in-browser](rules/sec-no-tokens-in-browser.md) | Keep tokens and secrets out of the browser | CRITICAL | scan |
| [bff-opaque-session-cookie](rules/bff-opaque-session-cookie.md) | The session cookie is opaque, HttpOnly, Secure and SameSite=Strict | CRITICAL | test, scan (candidates), review |
| [bff-store-keyed-by-hash](rules/bff-store-keyed-by-hash.md) | The store is keyed by a hash of the cookie id | CRITICAL | test, scan (candidates), review |
| [bff-shared-store](rules/bff-shared-store.md) | The store is shared by every replica | CRITICAL | review |
| [bff-idle-and-absolute-limit](rules/bff-idle-and-absolute-limit.md) | The session has an idle and an absolute limit | CRITICAL | test, review |
| [bff-refresh-ahead-and-on-401](rules/bff-refresh-ahead-and-on-401.md) | Refresh ahead of expiry, and once after a guard 401 | CRITICAL | test, scan (candidates), review |
| [bff-refresh-lock](rules/bff-refresh-lock.md) | One refresh at a time per session, across replicas | CRITICAL | test, scan (candidates), review |
| [bff-retry-buffered-body-only](rules/bff-retry-buffered-body-only.md) | Only a buffered body is retried after a refresh | CRITICAL | test, review |
| [bff-sign-out-server-side](rules/bff-sign-out-server-side.md) | Sign-out ends the session on the server too | CRITICAL | test, review |
| [struct-server-only](rules/struct-server-only.md) | Mark server code server-only | HIGH | test + eslint: kit; scan |

### Reads proxy

| ID | Rule | Impact | Check |
|---|---|---|---|
| [sec-proxy-raw-path-allowlist](rules/sec-proxy-raw-path-allowlist.md) | Check the raw path against an allow-list before proxying | CRITICAL | test |
| [sec-proxy-strip-headers](rules/sec-proxy-strip-headers.md) | Forward allow-listed headers only, and strip Set-Cookie from replies | CRITICAL | test |
| [bff-refuse-cross-site](rules/bff-refuse-cross-site.md) | Refuse cross-site calls | CRITICAL | test, scan, review |
| [bff-writes-405](rules/bff-writes-405.md) | Writes answer 405, except allow-listed uploads | CRITICAL | scan, test, review |
| [bff-writes-via-apiaction](rules/bff-writes-via-apiaction.md) | Writes go through apiAction and return a Result | CRITICAL | eslint, test, review |
| [bff-validate-replies](rules/bff-validate-replies.md) | Validate replies against the OpenAPI document | CRITICAL | ci, test, scan (candidates), review |
| [bff-no-backend-error-leaks](rules/bff-no-backend-error-leaks.md) | Errors don't leak the backend | CRITICAL | test, scan (candidates), review |
| [bff-no-self-fetch](rules/bff-no-self-fetch.md) | Server Components don't fetch their own route handlers | CRITICAL | eslint, scan (candidates), review |

### Config and proxy.ts

| ID | Rule | Impact | Check |
|---|---|---|---|
| [bff-config-per-call](rules/bff-config-per-call.md) | Read configuration per call, never at module load | HIGH | review |
| [bff-no-env-in-next-config](rules/bff-no-env-in-next-config.md) | next.config stays free of environment reads | HIGH | eslint, review |
| [bff-public-urls-from-config](rules/bff-public-urls-from-config.md) | Public URLs come from configuration, not from Host | HIGH | review |
| [bff-rewrite-backend-paths](rules/bff-rewrite-backend-paths.md) | proxy.ts rewrites the backend's public paths from the environment | HIGH | scan (candidates), test, review |
| [bff-matcher-matches-prefixes](rules/bff-matcher-matches-prefixes.md) | The matcher is a literal, kept in step with the prefix list | HIGH | eslint, review |
| [bff-gating-is-convenience](rules/bff-gating-is-convenience.md) | Page gating is a convenience; the backend is the check | HIGH | review |
| [bff-gating-next-same-site](rules/bff-gating-next-same-site.md) | Return-to URLs are same-site paths | HIGH | review |
| [bff-hide-backend-console-api](rules/bff-hide-backend-console-api.md) | The backend's console API is hidden from the browser | HIGH | test, review |
| [bff-request-id-forwarded](rules/bff-request-id-forwarded.md) | Request ids are set once and forwarded | HIGH | test, scan (candidates), review |

### Testing

| ID | Rule | Impact | Check |
|---|---|---|---|
| [bff-test-refused-paths](rules/bff-test-refused-paths.md) | Every refused path spelling answers 404 without a backend call | MEDIUM | review |
| [bff-test-cross-site-403](rules/bff-test-cross-site-403.md) | Cross-site calls answer 403 | MEDIUM | review |
| [bff-test-writes-405](rules/bff-test-writes-405.md) | Write methods answer 405 unless allow-listed | MEDIUM | review |
| [bff-test-no-set-cookie](rules/bff-test-no-set-cookie.md) | No reply carries Set-Cookie or a token | MEDIUM | review |
| [bff-test-guard-401-refresh](rules/bff-test-guard-401-refresh.md) | A guard 401 refreshes once; a handler 401 passes through | MEDIUM | review |
| [bff-test-one-refresh](rules/bff-test-one-refresh.md) | Concurrent requests near expiry cause one refresh | MEDIUM | review |
| [bff-test-signed-out](rules/bff-test-signed-out.md) | A signed-out request clears the cookie | MEDIUM | review |
| [bff-test-apiaction-results](rules/bff-test-apiaction-results.md) | apiAction returns a Result for every outcome | MEDIUM | review |
| [bff-test-matcher-prefixes](rules/bff-test-matcher-prefixes.md) | The matcher matches the prefix list | MEDIUM | scan, review |
| [bff-test-config-per-call](rules/bff-test-config-per-call.md) | Configuration is read per call | MEDIUM | review |

## 1. Files (`src/api/`, server-only)

| File | Does |
|---|---|
| `config.ts` | Reads the backend URL, client id/secret, cookie settings, store URL **per call** from the environment (never at module load), so one image runs everywhere |
| `cookies.ts` | Cookie names and serialisation (`__Host-`/`__Secure-` prefixes under https) |
| `store.ts` | The session store: Redis/Valkey when configured (shared by replicas), in-memory for dev and tests. Keys are a hash of the cookie id, so a store dump gives no working cookie |
| `session.ts` | Session records (`access`, `refresh`, `accessExp`, `signedIn`, revision), lifetimes, `accessFor(id)` with refresh |
| `oauth.ts`, `flow.ts` | Authorization request (state + PKCE), callback, token exchange, sign-out (`oauth-client`) |
| `forward.ts` | `forwardAs(sessionId, send)`: one backend call with the access token, one retry after a refresh |
| `proxy.ts` | The reads route handler: checks, forwards, validates, answers |
| `action.ts` | `apiAction(method, path, opts)`: the same forwarding for server actions, answering a `Result` |
| `result.ts` | `Result<T>`, `ApiError`, `fromEnvelope`, `errorText`: one shape for every reply |
| `validate.ts` | Checks replies against the backend's OpenAPI document |
| `schema.gen.ts` | Types generated from that document (`yarn gen:api`) |

Every file starts with `import "server-only"` (or is imported only from route handlers and actions). Client code imports `result.ts` types only.

## 2. Session and tokens

- **Cookie:** random id (32 bytes), `HttpOnly`, `Secure`, `SameSite=Strict` (Lax only for the short-lived authorization-request cookie, because the callback is a cross-site navigation), `Path=/`, no `Domain`. No `Max-Age` on the session cookie when it should end with the browser.
- **Store record:** tokens and their expiry, sign-in time, a revision counter. TTL = the idle limit, cut short by an absolute limit (e.g. idle 30 min, absolute 12 h; follow the authorization server's refresh-token lifetimes).
- **Refresh:** ahead of expiry (about 60 s early), and once after a backend 401 that carries `WWW-Authenticate: Bearer` (the guard's refusal, not a handler's own 401 such as "wrong current password").
- **One refresh at a time per session across replicas:** take a store lock (`SET NX PX`), refresh, write back only if the record's revision is unchanged (compare-and-set), release. Others wait briefly and re-read. Refresh tokens rotate; two parallel refreshes would trip the server's reuse detection and end the session.
- **Retry only a buffered body.** A streamed upload can't be sent twice, so it gets no retry after refresh.
- **Sign-out:** delete the record and clear the cookie, after revoking the refresh token (the steps and their order are in `oauth-client`).

## 3. The reads proxy (`app/<area>/api/[...path]/route.ts`)

```ts
import { handleApi } from "@/src/api/proxy";
export const dynamic = "force-dynamic";   // drop it if the app ever enables cacheComponents (the migration guide removes it)
export const GET = handleApi;
export const HEAD = handleApi;
export const POST = handleApi;   // only for the upload allow-list; everything else answers 405
```

- Map `/<area>/api/<path>` onto the backend's root for this surface, after checking the **raw** path (allow-listed first segments; no `.`/`..`, encoded slashes, backslashes or double encoding).
- Forward only allow-listed request headers; never the browser's `Cookie`. Add `Authorization: Bearer`, the scope header, and an `X-Request-Id` (incoming or new UUID).
- Refuse cross-site calls: require a custom header (`x-<app>-console: 1`, which a cross-site page can't send without a CORS preflight you never grant) and `Sec-Fetch-Site` same-origin when present.
- **Writes answer 405** except a short upload allow-list: writes are server actions, so CSRF protection, input validation and typed results live in one place.
- Strip `Set-Cookie` and hop-by-hop headers from the backend reply; tokens never appear in a reply.
- Answer the signed-out case with 401 plus a cleared cookie, so the client sends the user to sign in.

## 4. Writes (`apiAction`)

Same forwarding, but the session id comes from `headers()`, the reply is validated and converted with `fromEnvelope` into a `Result`, and backend unavailability becomes a 503 `Result` instead of a throw (`nextjs-data`).

## 5. Reply contract

- **One envelope** from the backend (for example `{ status, message, data, total?, errors? }`) becomes one `Result<T>` on the frontend; `ApiError` carries status, message and per-field errors into TanStack Query's `onError`. The envelope, its `status` values, status codes and field error paths are defined in `go-nextjs-api-contract`.
- **Validate replies against the OpenAPI document** on the Next server (the document checked into `src/api/`, regenerated by `yarn gen:api`, `--check` in CI). A mismatch answers 502 naming the operation and field outside production, and is only logged in production.
- Type everything from `schema.gen.ts`; no hand-written reply types.

## 6. `proxy.ts` (Next 16; `middleware.ts` before)

- **Rewrite the backend's own public paths** (`/api/*`, `/oauth2/*`, `/.well-known/*`, ...) to the backend URL read from the environment per request, so one image serves every environment. The `matcher` must be a static literal: keep it in step with the prefix list in code (a test can compare them).
- **The CSP nonce is set in the same `proxy.ts`** (`nextjs-security`, references/csp-and-headers.md); keep one matcher.
- **Hide the backend's console API** from the browser (404) when it should only be reached through the BFF.
- **Gate pages:** a protected page request without the session cookie redirects to sign-in with a `next` parameter (checked to be a same-site path). This is a convenience; the real check is the backend refusing the token.
- Keep `next.config.*` free of environment reads: Next evaluates it at build and again at start, with different environments.

## 7. Don'ts

- Don't fetch your own route handlers from Server Components (an extra HTTP hop, and it fails at build time); call the server function directly.
- Don't put tokens in `localStorage`, JS-readable cookies, URLs or replies.
- Don't trust `Host`/`X-Forwarded-*` for anything security-relevant; public URLs come from configuration.
- Don't log tokens, cookies or `Authorization` headers.

## Reviewing

1. **Scope.** The diff (`git diff <base>...HEAD`), a merge request's files or the whole app, read for what this skill covers: `src/api/`, the reads proxy route, `proxy.ts` and the session code.
2. **Scan.** `bash <this skill>/scripts/scan.sh <app-root>` lists candidates for the rules whose check includes `scan`. On a diff, keep only findings in changed lines or files. Every line is a candidate: open the rule and confirm it before reporting. Most rules here are checked by the project's own tests of `src/api/` and `proxy.ts` (the `bff-test-*` rules say which); the scan only points at the code shapes those tests guard.
3. **Read** the changed code against the Rules above. Open each rule you cite and match its "Incorrect" shape, not just its title.
4. **Report** each finding in the format of `agent-skills-authoring` ("Scan scripts and findings"): impact, rule ID, file and line, what to change citing the rule's "Correct" shape; ordered by impact. Raise the impact one level on an authentication, payment or deletion path.
5. **Say what's not covered:** rules whose check is `test` or `eslint` but the project has no such test or lint rule. `kit` in the Check column means a ready-to-copy check exists (`nextjs-new-app`, references/enforcement-kit.md).

## Checklist

- [ ] Browser holds only an opaque `HttpOnly` cookie; tokens live in the server-side store, keyed by hash
- [ ] Refresh ahead of expiry and once on a guard 401, under a cross-replica lock with compare-and-set
- [ ] Proxy checks the raw path, allow-lists headers, requires the same-site header, answers writes 405 (uploads excepted), strips `Set-Cookie`
- [ ] Writes are server actions returning `Result`; replies validated against OpenAPI; types generated
- [ ] Config read per request; `proxy.ts` matcher in step with the prefix list; request ids forwarded
- [ ] Tests: path refusals, cross-site refusal, refresh-and-retry, lock contention, signed-out handling
