# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Session and tokens | `bff-` | CRITICAL | The session cookie, the server-side store, refresh under a lock, sign-out, tokens kept from the browser |
| 2 | Reads proxy | `bff-` | CRITICAL | The raw-path allow-list, forwarded headers, same-site checks, 405 writes, reply stripping, signed-out answers |
| 3 | Config and proxy.ts | `bff-` | HIGH | Per-request config, `proxy.ts` rewrites and matcher, page gating, no environment in `next.config`, server-only code |
| 4 | Testing | `bff-test-` | MEDIUM | Path refusals, cross-site refusal, refresh-and-retry, lock contention, signed-out handling, config read per call |

Impact is the default severity of a finding; raise it when the code is on an authentication, payment or data-deletion path.
