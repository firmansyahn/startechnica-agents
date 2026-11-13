# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Security | `sec-` | CRITICAL | OAuth state, nonce and PKCE bound to the browser; return-to URLs validated as same-site paths |

Impact is the default severity of a finding; raise it when the code is on an authentication, payment or data-deletion path.
