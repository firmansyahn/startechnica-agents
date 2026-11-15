---
name: go-nextjs-api-contract
description: "Use when designing, changing, reviewing or testing the HTTP API between a Go backend and a Next.js (or other TypeScript) frontend: the OpenAPI 3.1 document as the source of truth (where it lives, who owns it, generating it from the Go route table or writing it first, keeping it current in CI), the reply envelope and its mapping to Result/ApiError, status codes, 422 field errors whose paths match form field names, WWW-Authenticate on guard 401s, list endpoints (pagination, sorting, filtering, search, total), PATCH with absent vs null, ids in paths, dates, money and enums on both sides, the scope/tenant header, request ids, versioning and deprecation, generated TypeScript types (openapi-typescript), reply validation, and contract tests on both sides."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for HTTP APIs between a Go backend and a TypeScript frontend.
metadata:
  author: firmansyahn
  version: "0.2.1"
---

# API contract: Go backend ↔ TypeScript frontend

**Principle:** One document describes every endpoint; both sides are generated from it or tested against it, so a change on one side that the other doesn't know about fails a build, not a page.

```
Go route table (method, path, request type, reply type, permission)
   │  go test ... -update                         generates, or checks without -update
   ▼
<module-root>/api/<surface>.openapi.json          OpenAPI 3.1, committed, owned by the backend
   │  yarn gen:api                                copies it and generates types; --check in CI
   ▼
<app-root>/src/api/<surface>.openapi.json + schema.gen.ts
   ├─ types:      components["schemas"]["Item"] in services, actions and fixtures
   └─ validation: the BFF checks replies against it (nextjs-bff); test fixtures pass the same check
```

Related: `go-project-layout` (where the document and the HTTP plumbing live: `api/`, `internal/httpx`), `go-http-handlers` (the Go handlers behind the contract), `nextjs-bff` (`result.ts`, `fromEnvelope`, `validate.ts`, the reply checks), `nextjs-data` (queries and actions built on the generated types), `nextjs-forms` (showing 422 field errors on fields), `oauth-server` (bearer tokens and `WWW-Authenticate`).

The project's own API guide or architecture doc wins where it differs; keep it and this skill from contradicting each other by linking, not copying.

## Read the reference for the task

| Task | Reference |
|---|---|
| Where the document lives, code-first vs spec-first, generating it, the frontend copy and types, CI checks, Go tooling, versioning and deprecation | [references/document.md](references/document.md) |
| The envelope, `Result`/`ApiError` mapping, status codes, field errors, `WWW-Authenticate`, rate limits, request ids, 5xx | [references/envelope-and-errors.md](references/envelope-and-errors.md) |
| Lists (pagination, sorting, filters, search), PATCH, ids, dates, money, enums, scope header, files | [references/resources.md](references/resources.md) |
| Backend tests of the document against the handlers; frontend fixtures checked against the document | [references/contract-tests.md](references/contract-tests.md) |

## Rules

One file per rule in `rules/`; the file name is the rule ID. Cite a rule by its ID. Sections and prefixes: [rules/_sections.md](rules/_sections.md).

### The document

| ID | Rule | Impact | Check |
|---|---|---|---|
| [contract-doc-every-route-documented](rules/contract-doc-every-route-documented.md) | Every route is in the document, with its reply types | HIGH | test |
| [contract-doc-generated-not-edited](rules/contract-doc-generated-not-edited.md) | Generated files are regenerated, never edited | MEDIUM | test |
| [contract-doc-types-same-mr](rules/contract-doc-types-same-mr.md) | The frontend copy and types change in the same merge request | MEDIUM | test |
| [contract-doc-generated-reply-types](rules/contract-doc-generated-reply-types.md) | Reply types come from the document, never hand-written | MEDIUM | review |
| [contract-doc-shared-failure-response](rules/contract-doc-shared-failure-response.md) | One shared Failure response, referenced by every operation | MEDIUM | test |
| [contract-doc-stable-operation-ids](rules/contract-doc-stable-operation-ids.md) | Operation ids are stable names | LOW | test, ci, review |
| [contract-doc-deprecate-before-removing](rules/contract-doc-deprecate-before-removing.md) | Nothing is removed or renamed without a deprecation first | HIGH | ci, review |
| [contract-doc-version-for-redesigns](rules/contract-doc-version-for-redesigns.md) | Surface versions are for redesigns, not for one field | LOW | review |

### Envelope and errors

| ID | Rule | Impact | Check |
|---|---|---|---|
| [contract-envelope-one-helper](rules/contract-envelope-one-helper.md) | Every JSON reply uses the envelope, written by one helper | HIGH | scan (candidates), test, review |
| [contract-status-matches-envelope](rules/contract-status-matches-envelope.md) | The HTTP status and the envelope's status agree | HIGH | test |
| [contract-field-errors-json-path](rules/contract-field-errors-json-path.md) | Field errors are a 422 keyed by the field's JSON path | HIGH | test |
| [contract-400-vs-422](rules/contract-400-vs-422.md) | 400 for unreadable requests, 422 for invalid values | MEDIUM | test |
| [contract-other-scope-404](rules/contract-other-scope-404.md) | Another scope's record is a 404, not a 403 | HIGH | test |
| [contract-guard-only-www-authenticate](rules/contract-guard-only-www-authenticate.md) | Only the guard's 401 carries WWW-Authenticate | HIGH | test |
| [contract-generic-5xx-message](rules/contract-generic-5xx-message.md) | A 5xx message is generic; the details go to the log with the request id | HIGH | scan, review |
| [contract-user-facing-messages](rules/contract-user-facing-messages.md) | Refusal messages are for users | MEDIUM | review |
| [contract-frontend-from-envelope](rules/contract-frontend-from-envelope.md) | The frontend maps every reply through fromEnvelope | MEDIUM | review |
| [contract-429-retry-after](rules/contract-429-retry-after.md) | 429 carries Retry-After | LOW | test |

### Resources and values

| ID | Rule | Impact | Check |
|---|---|---|---|
| [contract-snake-case-names](rules/contract-snake-case-names.md) | One spelling for every name: snake_case on the wire and in the frontend | MEDIUM | eslint, test, review |
| [contract-opaque-encoded-ids](rules/contract-opaque-encoded-ids.md) | Ids are opaque strings, encoded in paths | HIGH | scan (candidates), eslint (candidates), test, review |
| [contract-list-parameters](rules/contract-list-parameters.md) | Lists take offset, limit, sort, q and named filters, and answer total | MEDIUM | test, review |
| [contract-cap-limit-whitelist-sort](rules/contract-cap-limit-whitelist-sort.md) | The server caps limit and whitelists sort fields | HIGH | test, lint (gosec G201, G202), review |
| [contract-patch-changed-only](rules/contract-patch-changed-only.md) | PATCH sends only changed fields; absent and null differ | MEDIUM | test |
| [contract-go-patch-opt](rules/contract-go-patch-opt.md) | A Go PATCH type tells absent from null | MEDIUM | review |
| [contract-create-201-whole-row](rules/contract-create-201-whole-row.md) | A create answers 201 with the whole row | MEDIUM | test |
| [contract-rfc3339-utc-times](rules/contract-rfc3339-utc-times.md) | Times are RFC 3339 in UTC | MEDIUM | test, review |
| [contract-money-not-float](rules/contract-money-not-float.md) | Money is never a float | HIGH | review |
| [contract-enum-unknown-values](rules/contract-enum-unknown-values.md) | Enums are listed strings, and clients render unknown values | MEDIUM | review |
| [contract-empty-list-not-null](rules/contract-empty-list-not-null.md) | Empty lists are [], never null | MEDIUM | test |
| [contract-scope-header](rules/contract-scope-header.md) | The scope travels in one header | HIGH | test, scan (candidates), review |

### Testing

| ID | Rule | Impact | Check |
|---|---|---|---|
| [contract-test-stale-files-fail-ci](rules/contract-test-stale-files-fail-ci.md) | CI fails when the document or the generated types are stale | MEDIUM | test |
| [contract-test-replies-against-document](rules/contract-test-replies-against-document.md) | Handler tests check replies against the document | MEDIUM | test |
| [contract-test-routes-match-operations](rules/contract-test-routes-match-operations.md) | Every route is documented and every operation routed | MEDIUM | test |
| [contract-test-refusal-shape](rules/contract-test-refusal-shape.md) | Refusals are tested for their shape, not just their status | MEDIUM | test |
| [contract-test-fixtures-validated](rules/contract-test-fixtures-validated.md) | Frontend fixtures pass the same reply check as production | MEDIUM | test |
| [contract-test-typed-fixture-factories](rules/contract-test-typed-fixture-factories.md) | Fixtures come from typed factories | LOW | review |
| [contract-test-fake-checks-requests](rules/contract-test-fake-checks-requests.md) | The fake checks requests against the document too | LOW | test |

## The contract, short

| Topic | Decision |
|---|---|
| Document | OpenAPI **3.1** (JSON Schema 2020-12), one per API surface (`console`, `public`), committed under `<module-root>/api/`, owned by the backend |
| Source | **Code-first by default**: the Go route table declares each route's request and reply types; a test generates the document and fails when it's stale. Spec-first is fine if the handlers are then generated or validated from it |
| Frontend | A committed copy in `src/api/` plus `schema.gen.ts` from `openapi-typescript`; `yarn gen:api --check` in CI. The frontend never hand-writes a reply type |
| Envelope | `{ status: "success" \| "failed", message, data?, total?, errors? }` on every JSON reply, success and failure alike |
| Frontend shape | `fromEnvelope(status, body)` → `Result<T>` = `{ ok: true, data, total? }` \| `{ ok: false, error: { status, message, fields? } }`; `ApiError` carries the same into `onError` |
| Field errors | 422 only, `errors: { "<path>": ["reason", ...] }`; paths are the JSON field paths, dotted (`address.city`, `rules.2.value`), which are also the form field names; `""` for errors not tied to a field |
| Names | `snake_case` JSON fields and query parameters, one spelling on both sides (no camelCase mapping layer) |
| Lists | `GET /<resource>?offset&limit&sort&q&<filter>=`, `data: [...]`, `total` beside it; cursor pagination only for feeds and very large tables |
| PATCH | JSON Merge Patch semantics: absent = unchanged, `null` = clear; only changed fields sent |
| Values | Ids are opaque strings; times RFC 3339 in UTC; money as an integer of minor units plus a currency code (or a decimal string); enums as lowercase strings listed in the schema |
| Headers | `Authorization: Bearer`, the scope header (`Tenant-ID` or the project's name), `X-Request-Id` both ways |
| Change | Additive changes are free; a removal or rename goes through `deprecated: true` and a new field or version first |

## Rules that hold everywhere

1. **The document is the contract**: every route is in it, every reply matches it, and neither side changes without the document changing in the same merge request.
2. **Generated, never hand-edited**: the document from the route table (or the handlers from the document), the TypeScript types from the document; CI fails when any of them is stale.
3. **One envelope, one status code per meaning**; refusals are 4xx with a human `message`, faults are 5xx with a generic one.
4. **Field errors are a 422 keyed by the field's JSON path**, the same path the form uses; anything else is a form-level message.
5. **Guard 401s carry `WWW-Authenticate: Bearer`**; a handler's own 401 (wrong current password) doesn't, so the client refreshes only on the first.
6. **One spelling for every name** (`snake_case`), one format per value type (RFC 3339 UTC, minor units, lowercase enum strings), the same on both sides.
7. **PATCH distinguishes absent from null**, on the wire and in the Go type.
8. **Additive by default**; nothing a client reads is removed or renamed without a deprecation period.
9. **Both sides test against the document**: the backend's replies in handler tests, the frontend's fixtures in page tests.

## Reviewing

1. **Scope.** The diff (`git diff <base>...HEAD`), a merge request's files or the whole app, read for what this skill covers: the OpenAPI document, the handlers' replies, the generated types and the frontend's reply handling.
2. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check (set `ENVELOPE_DIRS` to the envelope helper's folder and the endpoints that answer outside the envelope). On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
3. **Read** the changed code against the Rules above. Open each rule you cite and match its "Incorrect" shape, not just its title.
4. **Report** each finding in the format of `agent-skills-authoring` ("Scan scripts and findings"): impact, rule ID, file and line, what to change citing the rule's "Correct" shape; ordered by impact. Raise the impact one level on an authentication, payment or deletion path.
5. **Say what's not covered:** rules whose check is `test`, `ci` or `eslint` but the project has no such test, job or lint rule. Ready-to-copy checks: [assets/openapi_rules_test.go](assets/openapi_rules_test.go) (the rules the document itself proves, one walk of `api/<surface>.openapi.json`), [assets/openapi_lists_test.go](assets/openapi_lists_test.go) (limit clamp and sort allow-list through the real handler), [assets/ci/openapi-breaking.sh](assets/ci/openapi-breaking.sh) (the breaking-change step against the target branch); `kit` in the Check column means one in `nextjs-new-app` (references/enforcement-kit.md).

## Checklist

- [ ] Route declared with request and reply types, permission and summary; document regenerated and committed
- [ ] `yarn gen:api` run; `schema.gen.ts` and the copy committed; `--check` passes
- [ ] Replies use the envelope; status codes per the table; 422 `errors` keyed by JSON path
- [ ] Guard 401 has `WWW-Authenticate: Bearer`; 429 has `Retry-After`; 5xx messages generic and logged with the request id
- [ ] Lists take `offset`/`limit`/`sort`/`q`/filters and answer `total`; limits capped server-side
- [ ] PATCH: absent vs null handled; only changed fields sent
- [ ] Times RFC 3339 UTC; money in minor units with currency; enums listed in the schema
- [ ] Nothing removed or renamed without `deprecated: true` first
- [ ] Handler tests validate replies against the document; frontend fixtures pass the reply check
