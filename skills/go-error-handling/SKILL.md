---
name: go-error-handling
description: "Use when creating, wrapping, returning, matching or logging errors in a Go server, or reviewing a Go diff for error handling: the handle-once rule (wrap and return, or log and degrade), %w wrapping with short context, sentinel errors and ...Error types matched with errors.Is/As, comma-ok assertions, no panic in request or worker paths, os.Exit and log.Fatal only in main. Absorbs samber/cc-skills-golang@golang-error-handling, adapted to the team (no samber/oops, lo or mo). Holds the err-* rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects.
metadata:
  author: firmansyahn
  version: "0.1.3"
---

# Go error handling (team)

**Principle:** Every error is handled once: wrapped with context and returned, or logged and degraded, never ignored and never both.

> **Absorbed.** This skill includes `samber/cc-skills-golang@golang-error-handling` (MIT, Samuel Berthe; source and pinned commit in [UPSTREAM.md](UPSTREAM.md)), adapted to the team: the team's rules and decisions come first and win, and "In depth" holds the upstream material, edited where the team decided otherwise. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill.

Related: [go-code-style](../go-code-style/SKILL.md) (the structured logger), [go-http-handlers](../go-http-handlers/SKILL.md) (where an error becomes a status), [go-how-to](../go-how-to/SKILL.md) (the Go skills and the rules they all assume).

## When to use

- Returning, wrapping or defining an error; deciding whether to log it
- A handler or worker that must turn a failure into a reply or a log line
- Reviewing a Go diff for swallowed errors, double logging or `panic`

## The team's rules

- **Handle each error once:** wrap and return, *or* log and degrade. Never log and return. The HTTP handler is where an error becomes a status plus a log line.
- **Wrap with short context**, no "failed to": `fmt.Errorf("load tenant %s: %w", id, err)`.
- **Give callers something to branch on** when they need it: a sentinel (`var ErrNotFound = errors.New(...)`, `errX` if unexported) or a type named `...Error`; match with `errors.Is`/`errors.As`, never `==` on a wrapped error or a string match.
- **Comma-ok type assertions**, `ctx.Value` lookups included.
- **No `panic`** in request or worker paths; return the error.
- **`os.Exit`/`log.Fatal` only in `main`, once:** `main` calls `run() error` and exits on its result ([go-project-layout](../go-project-layout/SKILL.md), `main` shape).

## Team decisions

1. **No `samber/oops`** (nor `samber/lo`, `samber/mo` or the other `samber/*` libraries): errors are wrapped with `fmt.Errorf("...: %w", err)` (`err-wrap-with-w`), and attributes go on the log line, not into the error.
2. **Logging goes through the injected `*zap.Logger`** (the team logs with zap, not slog; [go-observability](../go-observability/SKILL.md)), never `zap.L()` or another package-level default (`style-structured-logger`). Upstream's `slog` examples are written with zap: the error is `zap.Error(err)`, the other attributes typed fields.
3. Links to upstream skills that aren't absorbed (`golang-samber-oops`, `golang-samber-slog`) are skipped.

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [err-check-every-error](rules/err-check-every-error.md) | Check every returned error | HIGH | lint (errcheck) |
| [err-match-with-is-as](rules/err-match-with-is-as.md) | Match errors with errors.Is/As, never == or strings | HIGH | scan, lint (errorlint) |
| [err-no-panic](rules/err-no-panic.md) | Return errors; don't panic in request or worker paths | HIGH | scan |
| [err-exit-only-in-main](rules/err-exit-only-in-main.md) | Exit and log.Fatal only in main, once | MEDIUM | scan |
| [err-handle-once](rules/err-handle-once.md) | Handle each error once: wrap and return, or log and degrade | MEDIUM | scan (candidates) |
| [err-wrap-with-w](rules/err-wrap-with-w.md) | Wrap with %w and short context, without "failed to" | MEDIUM | scan, lint (errorlint) |

## Reviewing

1. **Scope:** the diff (`git diff <base>...HEAD -- '*.go'`), a merge request's files, or the whole module.
2. **Tools first**, from `<module-root>`: `gofmt -l .`, `go vet ./...`, and `golangci-lint run` when the project has a `.golangci.yml`. Report their findings as they are; a rule that names a linter isn't reported twice.
3. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check. On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
4. **Read** the code against the rules above, matching each rule's "Incorrect" shape, not just its title, and against the checklist below.
5. **Report** in the format of [agent-skills-authoring](../agent-skills-authoring/SKILL.md) ("Scan scripts and findings"), ordered by impact; list once, as a gap, the rules whose check is a test or linter the project doesn't have.

## Review checklist

- [ ] Every returned error checked; none discarded with `_` without a comment saying why
- [ ] Each error handled once: wrapped and returned, or logged and degraded
- [ ] Wrapped with `%w` and short context, no "failed to"
- [ ] Callers that branch get a sentinel or `...Error` type, matched with `errors.Is`/`As`
- [ ] No `panic` in request or worker paths; no `log.Fatal`/`os.Exit` outside `main`

## In depth

The material below is `samber/cc-skills-golang@golang-error-handling`, absorbed into this skill (source, pinned commit and licence in [UPSTREAM.md](UPSTREAM.md)) and edited where the team decided otherwise. The team's rules and decisions above win wherever the two still differ. Links of the form `samber/cc-skills-golang@<name>` name upstream skills: each one the team uses is absorbed into a team skill ([go-how-to](../go-how-to/SKILL.md), rule 1, maps the names), and the rest are not adopted.

**Persona:** You are a Go reliability engineer. You treat every error as an event that must either be handled or propagated with context — silent failures and duplicate logs are equally unacceptable.

**Orchestration mode:** Fan out the five category sub-agents described in the "Parallelizing Error Handling Audits" section (creation, wrapping, single-handling rule, panic/recover, structured logging) for auditing error handling across a large codebase, and consolidate their findings. To opt in explicitly: `ultracode` on Claude Code; `orchestrate` on oh-my-pi (`workflowz` for a deterministic multi-subagent workflow); on OpenCode, ask the agent to delegate to subagents, or mention one (`@general`).

**Modes:**

- **Coding mode** — writing new error handling code. Follow the best practices sequentially; optionally launch a background sub-agent to grep for violations in adjacent code (swallowed errors, log-and-return pairs) without blocking the main implementation.
- **Review mode** — reviewing a PR's error handling changes. Focus on the diff: check for swallowed errors, missing wrapping context, log-and-return pairs, and panic misuse. Sequential.
- **Audit mode** — auditing existing error handling across a codebase. Use up to 5 parallel sub-agents, each targeting an independent category (creation, wrapping, single-handling rule, panic/recover, structured logging).

This skill guides the creation of robust, idiomatic error handling in Go applications. Follow these principles to write maintainable, debuggable, and production-ready error code.

### Best Practices Summary

1. **Returned errors MUST always be checked** — NEVER discard with `_`
2. **Errors MUST be wrapped with context** using `fmt.Errorf("{context}: %w", err)`
3. **Error strings MUST be lowercase**, without trailing punctuation
4. **Use `%w` internally, `%v` at system boundaries** to control error chain exposure
5. **MUST use `errors.Is` for sentinel matching and `errors.As`/`errors.AsType` for typed chain inspection** instead of direct comparison or bare type assertions. For Go 1.26+, prefer `errors.AsType[T](err)` when `T` implements `error`; use `errors.As(err, &target)` for Go <1.26 or for non-error interface targets.
6. **SHOULD use `errors.Join`** (Go 1.20+) to combine independent errors
7. **Errors MUST be either logged OR returned**, NEVER both (single handling rule)
8. **Use sentinel errors** for expected conditions, custom types for carrying data
9. **NEVER use `panic` for expected error conditions** — reserve for truly unrecoverable states
10. **Log through the injected `*zap.Logger`** with `zap.Error(err)` and typed fields — not `fmt.Println` or `log.Printf`
11. **Put context on the log line, not in an error library:** tenant, user and IDs go on the handler's log line as structured attributes; the error itself is wrapped with `fmt.Errorf` (`samber/oops` is not adopted)
12. **Log HTTP requests** with structured middleware capturing method, path, status, and duration
13. **Use log levels** to indicate error severity
14. **Never expose technical errors to users** — translate internal errors to user-friendly messages, log technical details separately
15. **Keep log grouping low-cardinality** — at logging/APM boundaries, keep message templates stable and attach IDs, paths, line numbers, and counts as structured attributes. Error values may include useful operational context, but avoid putting high-cardinality data into the stable log message used for grouping.

### Detailed Reference

- **[Error Creation](./references/error-creation.md)** — How to create errors that tell the story: error messages should be lowercase, no punctuation, and describe what happened without prescribing action. Covers sentinel errors (one-time preallocation for performance), custom error types (for carrying rich context), and the decision table for which to use when.

- **[Error Wrapping and Inspection](./references/error-wrapping.md)** — Why `fmt.Errorf("{context}: %w", err)` beats `fmt.Errorf("{context}: %v", err)` (chains vs concatenation). How to inspect chains with `errors.Is`, `errors.As`, and Go 1.26+ `errors.AsType` for type-safe error handling, and `errors.Join` for combining independent errors.

- **[Error Handling Patterns and Logging](./references/error-handling.md)** — The single handling rule: errors are either logged OR returned, NEVER both (prevents duplicate logs cluttering aggregators). Panic/recover design, and logging the error with zap for APM tools. (Its `samber/oops` section is not adopted.)

### Parallelizing Error Handling Audits

When auditing error handling across a large codebase, use up to 5 parallel sub-agents — each targets an independent error category:

- Sub-agent 1: Error creation — validate `errors.New`/`fmt.Errorf` usage, low-cardinality messages, custom types
- Sub-agent 2: Error wrapping — audit `%w` vs `%v`, verify `errors.Is`/`errors.As` patterns
- Sub-agent 3: Single handling rule — find log-and-return violations, swallowed errors, discarded errors (`_`)
- Sub-agent 4: Panic/recover — audit `panic` usage, verify recovery at goroutine boundaries
- Sub-agent 5: Structured logging — verify the injected zap logger and `zap.Error(err)` at error sites, check for PII in error messages

### Cross-References

- → [go-observability](../go-observability/SKILL.md) for structured logging setup, log levels, and request logging middleware ([go-code-style](../go-code-style/SKILL.md) for the team's logging rules)
- → [go-safety](../go-safety/SKILL.md) for the nil interface trap and nil error comparison pitfalls
- → [[go-code-style](../go-code-style/SKILL.md) references/naming.md](../go-code-style/references/naming.md) for error naming conventions (ErrNotFound, PathError)

### References

- [go.uber.org/zap package](https://pkg.go.dev/go.uber.org/zap)
