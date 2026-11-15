---
name: nextjs-logging
description: "Use when adding, reviewing or debugging logging and error reporting in a Next.js App Router app: a structured server logger (pino, JSON to stdout), log levels and field names, request ids across proxy.ts, route handlers, server actions and backend calls, redacting secrets and personal data, instrumentation.ts (register, onRequestError), error.tsx/global-error.tsx and error digests, reporting browser errors, OpenTelemetry trace ids in logs, ESLint no-console, and testing what gets logged."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Next.js apps.
metadata:
  author: firmansyahn
  version: "0.2.0"
---

# Logging in Next.js

**Principle:** Logs are structured JSON on stdout from one server-side logger, with a request id on every line and no secrets ever.

One event per line. The platform (Kubernetes, a log shipper) collects stdout, and the app never writes log files.

Related: `nextjs-bff` (request ids on backend calls), `nextjs-data` (logging in the action helper), `go-code-style` (the backend's logging rules, which these mirror). Details:
- [references/server-logger.md](references/server-logger.md): the logger module, field names, redaction, request context, OpenTelemetry, tests
- [references/errors-and-reporting.md](references/errors-and-reporting.md): `onRequestError`, error boundaries and digests, browser error reporting, what each layer logs
- [assets/tests/client-error-endpoint.test.ts](assets/tests/client-error-endpoint.test.ts): the client-error endpoint's size cap, schema, rate limit and log line, against the real handler (copy to the app's `tests/`)

## Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### Logging

| ID | Rule | Impact | Check |
|---|---|---|---|
| [log-no-console](rules/log-no-console.md) | Log through the logger, not console | MEDIUM | eslint: kit (scan candidates) |
| [log-structured-request-id](rules/log-structured-request-id.md) | Log constant messages with fields and the request id | MEDIUM | eslint, review |
| [log-errors-under-err](rules/log-errors-under-err.md) | Errors go in err | MEDIUM | eslint, review |
| [log-backend-field-names](rules/log-backend-field-names.md) | Field names follow the backend's scheme | MEDIUM | review |
| [log-meaningful-levels](rules/log-meaningful-levels.md) | Levels mean something | MEDIUM | review |
| [log-no-info-per-request](rules/log-no-info-per-request.md) | No info line per request | MEDIUM | review |
| [log-route-template-not-url](rules/log-route-template-not-url.md) | Log the route template, never the query string | MEDIUM | review |
| [log-actions-via-helper](rules/log-actions-via-helper.md) | Actions log once, in the shared helper | MEDIUM | review |
| [log-config-at-runtime](rules/log-config-at-runtime.md) | Configuration is read at runtime | MEDIUM | review |
| [log-silent-probes](rules/log-silent-probes.md) | Health probes are silent | MEDIUM | scan, review |

### Redaction

| ID | Rule | Impact | Check |
|---|---|---|---|
| [log-no-secrets](rules/log-no-secrets.md) | Never log credentials, bodies or personal data | HIGH | test |
| [log-no-whole-headers](rules/log-no-whole-headers.md) | Never log headers wholesale | HIGH | eslint, review |
| [log-ids-over-personal-data](rules/log-ids-over-personal-data.md) | Prefer ids over personal values; mask when a value is needed | HIGH | review |
| [log-browser-reports-no-input](rules/log-browser-reports-no-input.md) | Browser reports carry no form values or tokens | HIGH | review |
| [log-redaction-test](rules/log-redaction-test.md) | A test proves the redaction | HIGH | scan, review |

### Errors

| ID | Rule | Impact | Check |
|---|---|---|---|
| [log-onrequesterror](rules/log-onrequesterror.md) | onRequestError logs every uncaught server error | MEDIUM | scan, review |
| [log-no-try-just-to-log](rules/log-no-try-just-to-log.md) | Don't wrap code in try/catch just to log | MEDIUM | review |
| [log-expected-failures-not-errors](rules/log-expected-failures-not-errors.md) | Expected failures are results, not errors | MEDIUM | review |
| [log-error-page-shows-digest](rules/log-error-page-shows-digest.md) | Error pages show the digest, never the server's message | MEDIUM | scan, review |
| [log-global-error-page](rules/log-global-error-page.md) | The root layout has a global-error page | MEDIUM | scan |
| [log-browser-errors-once](rules/log-browser-errors-once.md) | Browser errors are reported once, through one channel | MEDIUM | review |
| [log-client-endpoint-limited](rules/log-client-endpoint-limited.md) | The client-error endpoint is validated and rate-limited | MEDIUM | test, review |
| [log-source-maps-not-served](rules/log-source-maps-not-served.md) | Source maps are uploaded, not served | MEDIUM | scan, review |

## 1. Where logging happens

| Layer | Logs | Doesn't log |
|---|---|---|
| `proxy.ts` | Nothing per request (the ingress/reverse proxy has access logs); sets the request id | Every request a second time |
| Route handlers (BFF proxy, auth callbacks, webhooks) | One line per backend call: method, route template, status, duration, request id; refusals at `warn` | Bodies, headers, tokens, query strings with codes |
| Server actions | In the shared action helper only: action name, outcome (`ok`/status), duration | Inputs, outputs |
| Server Components | Only unexpected failures (and those reach `onRequestError` anyway) | Normal renders |
| `instrumentation.ts` | `onRequestError`: every uncaught server error with digest, route, route type | |
| Browser | Nothing to the console in production; errors reported to the server or an error tracker | User input, tokens |
| Health probes (`/livez`, `/readyz`) | Nothing | |

## 2. Rules

- **One logger** (`src/libs/logger.ts`, `import "server-only"`), built on **pino**; no `console.*` in app code (ESLint `no-console`, allowed in `scripts/` and tests).
- **JSON to stdout in every environment except local dev**, where `pino-pretty` makes it readable. The level comes from `LOG_LEVEL`, read at runtime.
- **Message is a constant phrase, data goes in fields:** `log.warn({ status, route }, "backend refused call")`, not template strings. Errors go in `err` (pino serialises message, type and stack).
- **Request id everywhere:** taken from `x-request-id` (or a new UUID) in `proxy.ts`, forwarded to the backend, attached to every log line through a child logger, and shown to users in error pages so support can find the logs.
- **Redact by default:** `authorization`, `cookie`, `set-cookie`, `password`, `secret`, `token`, `access`, `refresh`, `code`, `client_secret`, `apiKey` at any depth are replaced with `[redacted]`. Personal data (email, phone, names, IPs) is logged only when needed and then masked.
- **Levels:** `error` needs someone to act; `warn` is a handled degradation (backend 5xx, refused refresh, validation mismatch); `info` is lifecycle and notable business events (sign-in, sign-out, settings changed); `debug` is for development. No `info` per request.
- **Field names follow one scheme** (ECS or OpenTelemetry semantic conventions), the same one the backend uses, so the two can be joined in one query.
- **Never log in the browser bundle what the server should log**, and never ship debug logs to production clients.

## 3. Setup steps

1. Add the logger module (`server-logger.md`), `yarn add pino` and `yarn add -D pino-pretty`. Both are on Next's built-in `serverExternalPackages` list, so no config is needed unless an older Next says otherwise.
2. Set or forward `x-request-id` in `proxy.ts`; read it with `requestLogger()` in handlers and actions.
3. Add `instrumentation.ts` with `onRequestError` (`errors-and-reporting.md`).
4. Add `error.tsx` / `global-error.tsx` that show the error digest as a reference.
5. Add browser error reporting (a route handler or the error tracker's SDK in `instrumentation-client.ts`); a route handler gets `assets/tests/client-error-endpoint.test.ts`.
6. Turn on `no-console`; replace existing `console.*` calls.
7. Add the redaction test.

## Reviewing

1. **Scope.** The diff (`git diff <base>...HEAD`), a merge request's files or the whole app, read for what this skill covers: the logger, log calls and error handling.
2. **Scan.** `bash <this skill>/scripts/scan.sh <app-root>` lists candidates for the rules whose check includes `scan`. On a diff, keep only findings in changed lines or files. Every line is a candidate: open the rule and confirm it before reporting. Run it after `next build` too: it then also checks the build output for served source maps.
3. **Read** the changed code against the Rules above. Open each rule you cite and match its "Incorrect" shape, not just its title.
4. **Report** each finding in the format of `agent-skills-authoring` ("Scan scripts and findings"): impact, rule ID, file and line, what to change citing the rule's "Correct" shape; ordered by impact. Raise the impact one level on an authentication, payment or deletion path.
5. **Say what's not covered:** rules whose check is `test` or `eslint` but the project has no such test or lint rule. `kit` in the Check column means a ready-to-copy check exists (`nextjs-new-app`, references/enforcement-kit.md).

## Checklist

- [ ] One pino logger, server-only, JSON to stdout, `LOG_LEVEL` at runtime, pretty only in local dev
- [ ] Request id generated/forwarded in `proxy.ts`, sent to the backend, on every line, shown on error pages
- [ ] Constant messages, data in fields, errors in `err`; one field-name scheme shared with the backend
- [ ] Redaction covers credentials at any depth; a test proves it
- [ ] `onRequestError` logs uncaught server errors with digest and route
- [ ] Browser errors reported, not `console.log`ged; no `console.*` in app code
- [ ] No per-request `info` noise; health probes silent
