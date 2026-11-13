# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Logging | `log-` | MEDIUM | The logger instead of console, constant messages with fields, levels, request ids, field names |
| 2 | Redaction | `log-` | HIGH | Secrets, bodies and personal data kept out of logs |
| 3 | Errors | `log-` | MEDIUM | `onRequestError`, digests, `error.tsx`, browser error reporting, source maps |

Impact is the default severity of a finding; raise it when the code is on an authentication, payment or data-deletion path.
