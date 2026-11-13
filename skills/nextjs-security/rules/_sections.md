# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | CSP and headers | `sec-` | HIGH | Nonce or hash CSP, the theme script, third-party origins, report-only rollout, security headers, framing, x-powered-by |
| 2 | Data and secrets | `sec-` | HIGH | DTOs to client components, the data layer, environment access, `NEXT_PUBLIC_`, runtime config, `.env` files, error replies, taint |
| 3 | Requests | `sec-` | CRITICAL | Route handler auth, GET without side effects, origin checks, CORS, redirects, public URLs, server fetches, uploads, rate limits, client IPs |
| 4 | Dependencies | `deps-` | MEDIUM | Audits in CI, accepted advisories, framework releases, update bots, lockfile review, immutable installs, install scripts, new dependencies |

Impact is the default severity of a finding; raise it when the code is on an authentication, payment or data-deletion path.
