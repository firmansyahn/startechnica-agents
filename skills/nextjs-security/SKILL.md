---
name: nextjs-security
description: "Use when hardening, reviewing or auditing the security of a Next.js App Router app beyond its auth flow: Content-Security-Policy with per-request nonces in proxy.ts (strict-dynamic, dynamic rendering, inline theme scripts, third-party scripts, report-only rollout, SRI), security headers (HSTS, frame-ancestors/X-Frame-Options, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, COOP/CORP), the data-security model (Data Access Layer, DTOs, server-only, React taint APIs), environment variables and secrets (NEXT_PUBLIC_ is public, next.config env inlining), route handler auth and CSRF outside server actions, open redirects, SSRF in server-side fetches, file uploads, rate limiting, and dependency hygiene (yarn npm audit, Renovate, lockfile review, install scripts)."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.2.1"
---

# Next.js security

**Principle:** Every request, header, upload and dependency is hostile until checked, data access stays on the server, and new policies go out report-only first.

The auth flow, the session and the server-action rules have their own skills; this one covers what sits around them. Start from the map, read the reference for the task, and check the rules before you call a change done.

## Where each concern lives

| Concern | Skill |
|---|---|
| Session cookie, tokens in the server-side store, refresh, the reads proxy and its path/header checks | `nextjs-bff` |
| Sign-in, state/PKCE/nonce, the refresh grant, sign-out, safe `next` redirects after sign-in | `oauth-client` |
| Server action input validation, identity from the session, authorization, `Result`, `allowedOrigins`, the encryption key | `nextjs-data` |
| What may be logged, redaction, error digests | `nextjs-logging` |
| CSP and headers, data exposure, env and secrets, route handlers, redirects, SSRF, uploads, rate limits, dependencies | **this skill** |

Related: `nextjs-how-to` (which skill covers what), `nextjs-new-app` (the enforcement kit), `nextjs-ui` (the theme script that CSP must allow), `nextjs-package-manager` (Yarn commands), `nextjs-e2e` (header and CSP checks in a real browser). Check the installed Next version's docs in `node_modules/next/dist/docs/01-app/02-guides/` (`content-security-policy.md`, `data-security.md`, `environment-variables.md`, `authentication.md`) before relying on an API.

## Read the reference for the task

| Task | Reference |
|---|---|
| Set a CSP (nonce or not), roll it out, fit the theme script and third-party scripts, set the other security headers | [references/csp-and-headers.md](references/csp-and-headers.md) |
| Keep data and secrets on the server: Data Access Layer, DTOs, `server-only`, taint, env vars, error output | [references/data-and-secrets.md](references/data-and-secrets.md) |
| Route handlers (auth, CSRF), redirects, server-side fetches to user-given URLs, uploads, rate limits | [references/requests.md](references/requests.md) |
| Audits, Renovate, lockfile review, install scripts, CI gates | [references/dependencies.md](references/dependencies.md) |
| Check the headers and CSP in a browser, the route handlers' session and origin checks in Vitest, framework advisories and prerendered nonce pages in CI | [assets/e2e/security-headers.spec.ts](assets/e2e/security-headers.spec.ts) (to `tests/e2e/`), [assets/tests/route-handlers.test.ts](assets/tests/route-handlers.test.ts) (to `tests/`), [assets/ci/security.gitlab-ci.yml](assets/ci/security.gitlab-ci.yml) with [framework-advisories.mjs](assets/ci/framework-advisories.mjs) and [prerendered-pages.mjs](assets/ci/prerendered-pages.mjs) (to `scripts/ci/`) |

## Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### CSP and headers

| ID | Rule | Impact | Check |
|---|---|---|---|
| [sec-csp-nonce](rules/sec-csp-nonce.md) | Allow scripts by a per-request nonce or a hash, never by 'unsafe-inline' | HIGH | test |
| [sec-nonce-pages-dynamic](rules/sec-nonce-pages-dynamic.md) | Nonce pages render dynamically | HIGH | ci |
| [sec-unsafe-eval-dev-only](rules/sec-unsafe-eval-dev-only.md) | 'unsafe-eval' only in development | HIGH | test (the `sec-csp-nonce` end-to-end test) |
| [sec-theme-script-csp](rules/sec-theme-script-csp.md) | The theme script passes the CSP by nonce or hash | HIGH | test, scan (candidates) |
| [sec-exact-third-party-origins](rules/sec-exact-third-party-origins.md) | Third-party origins are exact, and few | HIGH | test, review |
| [sec-csp-report-only-first](rules/sec-csp-report-only-first.md) | New policies go out report-only first | HIGH | review |
| [sec-security-headers](rules/sec-security-headers.md) | Send the security headers on every response, with x-powered-by off | MEDIUM | test |
| [sec-deny-framing](rules/sec-deny-framing.md) | Framing is denied unless a page is meant to be embedded | HIGH | test, review |

### Data and secrets

| ID | Rule | Impact | Check |
|---|---|---|---|
| [sec-dto-to-client](rules/sec-dto-to-client.md) | Pass client components DTOs, never records | HIGH | review |
| [sec-data-layer-checks-caller](rules/sec-data-layer-checks-caller.md) | Data access is server-only and checks the caller | HIGH | review |
| [sec-env-access-limited](rules/sec-env-access-limited.md) | Only the data layer and the config reader touch process.env | HIGH | eslint, review |
| [sec-no-public-secrets](rules/sec-no-public-secrets.md) | Never put a secret in NEXT_PUBLIC_ variables or next.config env | CRITICAL | scan |
| [sec-config-per-request](rules/sec-config-per-request.md) | Runtime config is read per request | HIGH | review |
| [sec-no-committed-env-values](rules/sec-no-committed-env-values.md) | .env files with real values are never committed | HIGH | scan, review |
| [sec-error-replies-generic](rules/sec-error-replies-generic.md) | Error replies are generic | HIGH | review |
| [sec-taint-not-boundary](rules/sec-taint-not-boundary.md) | Taint is a seatbelt, not the boundary | HIGH | review |

### Requests

| ID | Rule | Impact | Check |
|---|---|---|---|
| [sec-route-handler-auth-origin](rules/sec-route-handler-auth-origin.md) | Authenticate and authorize in every route handler, check the origin on writes, and never change state on GET | CRITICAL | test, review |
| [sec-no-cors-reflection](rules/sec-no-cors-reflection.md) | No credentialed CORS by reflection | CRITICAL | review |
| [sec-public-urls-from-config](rules/sec-public-urls-from-config.md) | Public URLs come from configuration, not Host | CRITICAL | review |
| [sec-ssrf-allowlist](rules/sec-ssrf-allowlist.md) | Allow-list server fetches to user-supplied URLs | HIGH | review |
| [sec-upload-handling](rules/sec-upload-handling.md) | Cap, sniff and store uploads under random names, and serve them as attachments | HIGH | review |
| [sec-rate-limit-endpoints](rules/sec-rate-limit-endpoints.md) | Expensive and guessable endpoints are rate-limited | CRITICAL | review |
| [sec-client-ip-from-trusted-proxy](rules/sec-client-ip-from-trusted-proxy.md) | The client IP comes from the trusted proxy only | CRITICAL | scan, review |

### Dependencies

| ID | Rule | Impact | Check |
|---|---|---|---|
| [tool-dependency-audit](rules/tool-dependency-audit.md) | Audit production dependencies in CI, and write down accepted advisories | LOW | scan |
| [deps-framework-patches-fast](rules/deps-framework-patches-fast.md) | Framework security releases go in within days | MEDIUM | ci |
| [deps-update-bot](rules/deps-update-bot.md) | A bot opens updates, and lockfile maintenance runs weekly | MEDIUM | scan, review |
| [deps-review-lockfile-diffs](rules/deps-review-lockfile-diffs.md) | Lockfile diffs are reviewed like code | MEDIUM | review |
| [deps-immutable-installs](rules/deps-immutable-installs.md) | Installs are immutable, with one lockfile | MEDIUM | scan |
| [deps-limit-install-scripts](rules/deps-limit-install-scripts.md) | Install scripts run only where needed | MEDIUM | review |
| [deps-new-dependency-decision](rules/deps-new-dependency-decision.md) | A new dependency is a decision, not a reflex | MEDIUM | review |

## Rules that hold everywhere

1. **Strict script CSP**: `script-src 'self' 'nonce-…' 'strict-dynamic'` (no `'unsafe-inline'`, no `'unsafe-eval'` outside dev), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`; nonce pages render dynamically.
2. **Security headers on every response**: HSTS (where all hosts are HTTPS), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`, `X-Frame-Options: DENY`, COOP `same-origin`; `poweredByHeader: false`.
3. **Data reaches the client only as DTOs** built in a `server-only` Data Access Layer; whole records, tokens and secrets never cross the server/client boundary.
4. **`NEXT_PUBLIC_` and `next.config` `env` are public and frozen at build**; secrets are read on the server, per request, from the environment the secret store fills.
5. **Every route handler authenticates and authorizes itself**; state-changing handlers check origin (`Sec-Fetch-Site`/`Origin`) and never run on `GET`.
6. **No redirect to a URL the request supplied** unless it is checked to be a same-site path.
7. **Server-side fetches to a user-supplied URL go through an allow-list** with private-address blocking, no redirects followed, and timeouts.
8. **Uploads are size-capped while streaming, type-checked by content, stored under random names outside the app, and served as attachments with `nosniff`.**
9. **Expensive or guessable endpoints are rate-limited** (sign-in, password reset, uploads, search), at the edge or in a shared store.
10. **Dependencies are audited in CI, updated by bot, and lockfile changes are reviewed**; Yarn only, `--immutable` installs.

## Reviewing

1. **Scope.** The diff (`git diff <base>...HEAD`), a merge request's files or the whole app, read for what this skill covers: `proxy.ts`, `next.config`, env files, route handlers, uploads and the CI audit step.
2. **Scan.** `bash <this skill>/scripts/scan.sh <app-root>` lists candidates for the rules whose check includes `scan`. On a diff, keep only findings in changed lines or files. Every line is a candidate: open the rule and confirm it before reporting. The rules whose check is `test` or `ci` are enforced by the assets above where the app has copied them: the headers spec, the route-handler test and the two CI jobs.
3. **Read** the changed code against the Rules above. Open each rule you cite and match its "Incorrect" shape, not just its title.
4. **Report** each finding in the format of `agent-skills-authoring` ("Scan scripts and findings"): impact, rule ID, file and line, what to change citing the rule's "Correct" shape; ordered by impact. Raise the impact one level on an authentication, payment or deletion path.
5. **Say what's not covered:** rules whose check is `test` or `eslint` but the project has no such test or lint rule. `kit` in the Check column means a ready-to-copy check exists (`nextjs-new-app`, references/enforcement-kit.md).

## Checklist

- [ ] CSP set in `proxy.ts` with a fresh nonce per request (or a static policy with SRI where pages must stay static); report-only first, then enforced
- [ ] Theme script and third-party scripts allowed by nonce or hash, not `'unsafe-inline'`
- [ ] Security headers present on pages, route handlers and the reads proxy; `x-powered-by` off
- [ ] Data Access Layer is `server-only`, returns DTOs; `process.env` read only there and in `src/api/config`
- [ ] No secret in `NEXT_PUBLIC_*` or `next.config` `env`; `.env*` gitignored except `.env.example`
- [ ] Route handlers authenticate, authorize, check origin on writes; no state change on `GET`
- [ ] Redirect targets validated; server fetches allow-listed; uploads capped, sniffed, stored safely
- [ ] Rate limits on sign-in and other expensive endpoints
- [ ] `yarn npm audit` in CI; Renovate on; lockfile diffs reviewed; install scripts allow-listed
- [ ] A browser test checks the CSP and headers on a real page, in each theme (`assets/e2e/security-headers.spec.ts`, run by `nextjs-e2e`)
