# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID cited in reviews. The `contract-` prefixes keep these IDs apart from [go-http-handlers](../../go-http-handlers/SKILL.md)' `api-*` rules.

| # | Section | Prefix | Impact | Covers |
|---|---|---|---|---|
| 1 | The document | `contract-doc-` | MEDIUM-HIGH | The OpenAPI document, generated files and types, operation ids, deprecation and versions |
| 2 | Envelope and errors | `contract-` | HIGH | The reply envelope, status codes, field errors, `WWW-Authenticate`, 5xx and refusal messages, the frontend's mapping |
| 3 | Resources and values | `contract-` | MEDIUM-HIGH | Field names, ids, lists, PATCH, creates, times, money, enums, empty lists, the scope header |
| 4 | Testing | `contract-test-` | MEDIUM | CI staleness checks, handler replies and refusals against the document, routes vs operations, frontend fixtures and the fake |

Impact is the default severity of a finding; raise it when the endpoint is on an authentication, payment or data-deletion path.
