---
name: go-http-handlers
description: "Use when writing, changing, testing or reviewing HTTP handlers and outbound HTTP calls in a Go server: limiting request bodies, decoding into a typed struct and validating it, mapping errors to statuses in one place, returning right after writing an error, never sending internal errors to the client, closing outbound response bodies, testing handlers with httptest. The reply's shape (envelope, status codes, field errors, OpenAPI) is go-nextjs-api-contract's. No samber skill covers handlers; this is the team's own. Holds the api-* rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects.
metadata:
  author: firmansyahn
  version: "0.1.2"
---

# Go HTTP handlers (team)

**Principle:** A handler limits, decodes and validates its input before using it, maps errors to statuses in one place, and never sends an internal error to the client.

The team's own skill: no upstream `golang-*` skill covers HTTP handlers (upstream's `golang-grpc`, `golang-swagger` and the web-framework skills aren't adopted). What a reply looks like on the wire (envelope, status codes, field errors, pagination, the OpenAPI document) is [go-nextjs-api-contract](../go-nextjs-api-contract/SKILL.md); this skill is the Go code behind it. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win.

Related: [go-error-handling](../go-error-handling/SKILL.md) (the handler is where an error becomes a status and a log line), [go-security](../go-security/SKILL.md) (authorization, server timeouts, SSRF), [go-project-layout](../go-project-layout/SKILL.md) (handlers are the Surface layer), [go-testing](../go-testing/SKILL.md), [go-how-to](../go-how-to/SKILL.md) (the Go skills and the rules they all assume).

## When to use

- Adding or changing an endpoint's handler
- Calling another service over HTTP
- A handler that answers 500 with an internal message, writes twice, or reads an unbounded body
- Reviewing a Go diff that touches handlers or HTTP clients

## The team's rules

- **Handlers are thin:** decode, validate, call the Domain, encode. Business rules and SQL stay out (`layer-imports-point-down`, `db-sql-in-data-layer`).
- **Limit the body before reading it** (`http.MaxBytesReader`), with a limit that fits the route.
- **Decode into a typed struct and validate it** before use; unknown fields refused where the contract says so.
- **One place maps errors to statuses** (a helper the handlers share); the client gets the contract's error shape, never `err.Error()` of an internal error. The handler logs the internal error once (`err-handle-once`).
- **Return right after writing an error response**; nothing writes twice.
- **Close every outbound response body** (`defer resp.Body.Close()` after the error check), and give the client a timeout (`conc-outbound-timeouts`).
- **Test with `httptest`**, asserting on status, headers and body; database-backed handler tests use a real database (`test-real-database`).

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [api-decode-and-validate](rules/api-decode-and-validate.md) | Decode into a typed struct and validate it before use | HIGH | review |
| [api-limit-request-body](rules/api-limit-request-body.md) | Limit request bodies before reading them | HIGH | scan (candidates) |
| [api-return-after-error](rules/api-return-after-error.md) | Return right after writing an error response | HIGH | scan |
| [api-close-response-body](rules/api-close-response-body.md) | Close every outbound response body | MEDIUM | scan, lint (bodyclose) |
| [api-status-from-errors](rules/api-status-from-errors.md) | Map errors to statuses in one place and never send internal errors | MEDIUM | scan (candidates) |

## Reviewing

1. **Scope:** the diff (`git diff <base>...HEAD -- '*.go'`), a merge request's files, or the whole module.
2. **Tools first**, from `<module-root>`: `gofmt -l .`, `go vet ./...`, and `golangci-lint run` when the project has a `.golangci.yml`. Report their findings as they are; a rule that names a linter isn't reported twice.
3. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check. On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
4. **Read** the code against the rules above, matching each rule's "Incorrect" shape, not just its title, and against the checklist below.
5. **Report** in the format of `agent-skills-authoring` ("Scan scripts and findings"), ordered by impact; list once, as a gap, the rules whose check is a test or linter the project doesn't have.

## Review checklist

- [ ] Body limited, decoded into a typed struct, validated
- [ ] Errors mapped to statuses in one place; no internal error text in replies
- [ ] `return` after every error write
- [ ] Outbound response bodies closed; clients have timeouts
- [ ] Handler tests with `httptest` on status, headers and body
