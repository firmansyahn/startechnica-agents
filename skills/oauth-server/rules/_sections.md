# Sections

Rule files are named `oauth-<slug>.md`; the file name without `.md` is the rule ID. Cite a rule by its ID. The client side's rules are in `oauth-client` (`sec-oauth-*`, `sec-safe-redirect-next`).

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | Flow | `oauth-` | CRITICAL | The protocol library, grants, PKCE, redirect matching, authorization codes |
| 2 | Tokens | `oauth-` | HIGH | Storage as hashes, refresh rotation and reuse, session-bound first-party tokens, signing keys |
| 3 | Access | `oauth-` | CRITICAL | One resource per token, scopes under roles, the shared verifier, scope ceilings, consent |
| 4 | Pages and endpoints | `oauth-` | HIGH | Issuer from config, sign-in page hardening, throttling, uniform refusals, logging |

Impact is the default severity of a finding; the authorization server is an authentication path, so don't lower it.
