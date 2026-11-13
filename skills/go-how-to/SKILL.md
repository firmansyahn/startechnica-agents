---
name: go-how-to
description: "Use at the start of any Go backend work when it isn't clear which skill applies, or when a task spans several: starting a service, adding an endpoint end to end, onboarding to the team's Go conventions, asking 'what are our rules for Go' or 'how do we do X in Go'. Routes to the focused team skills (go-project-layout, go-code-style, go-error-handling, go-concurrency, go-database, go-testing, go-security, go-http-handlers, go-knadh-koanf), the vendored samber/cc-skills-golang golang-* skills each one overrides, go-nextjs-api-contract and the OAuth skills, and lists the rules they all assume and the toolchain commands. Each skill reviews its own rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode or similar harness, and for Go server projects.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# Go: which skill, and what they all assume

This skill only routes: open the skill the task needs, and only that one. Each skill holds its patterns, its rules (one file per rule, indexed with how each is caught), its `scripts/scan.sh` and a "Reviewing" section.

The skills follow the samber/cc-skills-golang shape: one focused skill per topic, and this router in place of upstream's `golang-how-to`. The general Go material is [samber/cc-skills-golang](https://github.com/samber/cc-skills-golang) (MIT). Where the team has a skill on the same topic, the upstream skill is **absorbed** into it: `go-<topic>` holds the team's rules and decisions first and the upstream material, edited to agree, under "In depth" (its `UPSTREAM.md` gives the pinned commit). Upstream skills on topics the team has no skill for are **vendored** unchanged as `golang-*`; a team skill that touches their topic says where the team differs, and wins.

**How to use it:** the skills are installed together, each in its own folder beside this one, wherever the project or user keeps skills; the links below are relative to this file, and a skill named in backticks is the folder of that name beside this one. Open the linked `SKILL.md` with Read (they may not be registered as invocable skills), then only the references and rules it points to.

## Pick the skill

| The task | Team skill | Upstream skill absorbed; vendored neighbours it overrides | Rules |
|---|---|---|---|
| Module layout, `cmd/` and `internal/`, where a package goes, the layers and their architecture test, wiring, `go.mod` and dependencies | [go-project-layout](../go-project-layout/SKILL.md) | golang-project-layout; [golang-dependency-injection](../golang-dependency-injection/SKILL.md), [golang-dependency-management](../golang-dependency-management/SKILL.md), [golang-design-patterns](../golang-design-patterns/SKILL.md) | `layer-` |
| Formatting, naming, structs and interfaces, time types, JSON tags, logging, doc comments, lint, modernizing | [go-code-style](../go-code-style/SKILL.md) | golang-code-style; [golang-naming](../golang-naming/SKILL.md), [golang-structs-interfaces](../golang-structs-interfaces/SKILL.md), [golang-documentation](../golang-documentation/SKILL.md), [golang-lint](../golang-lint/SKILL.md), [golang-modernize](../golang-modernize/SKILL.md), [golang-observability](../golang-observability/SKILL.md) | `style-` |
| Creating, wrapping, matching and logging errors; panics; exits | [go-error-handling](../go-error-handling/SKILL.md) | golang-error-handling | `err-` |
| Goroutines, workers, `context.Context`, deadlines, mutexes, channels, shutdown | [go-concurrency](../go-concurrency/SKILL.md) | golang-concurrency; [golang-context](../golang-context/SKILL.md) | `conc-` |
| Queries, transactions, soft deletes, IDs, migrations, `pgx` | [go-database](../go-database/SKILL.md) | golang-database | `db-` |
| Unit, database and handler tests; `-race`, `t.Parallel`, flaky or slow tests | [go-testing](../go-testing/SKILL.md) | golang-testing; [golang-benchmark](../golang-benchmark/SKILL.md) | `test-` |
| Authorization, SQL injection, secrets, TLS, paths, SSRF, a security review | [go-security](../go-security/SKILL.md) | golang-security | `sec-` |
| HTTP handlers and outbound HTTP calls: bodies, decoding, error statuses | [go-http-handlers](../go-http-handlers/SKILL.md) | (no upstream skill) | `api-` |
| Loading, adding, validating or testing settings (koanf) | [go-knadh-koanf](../go-knadh-koanf/SKILL.md) | (no upstream koanf skill; golang-spf13-viper not adopted) | |
| An endpoint's request and reply shape: envelope, status codes, field errors, pagination, OpenAPI | [go-nextjs-api-contract](../go-nextjs-api-contract/SKILL.md) | | `contract-` |
| Running an OAuth 2.1 authorization server, or calling one as a client | [oauth-server](../oauth-server/SKILL.md), [oauth-client](../oauth-client/SKILL.md) | | `oauth-`, `sec-oauth-` |
| Nil, zero values, overflow, aliasing, defer pitfalls | | [golang-safety](../golang-safety/SKILL.md) | |
| Slices, maps, `container/*`, generic collections | | [golang-data-structures](../golang-data-structures/SKILL.md) | |
| Allocation, CPU and latency work; benchmarks | | [golang-performance](../golang-performance/SKILL.md), [golang-benchmark](../golang-benchmark/SKILL.md) | |
| Refactoring a package or API safely | | [golang-refactoring](../golang-refactoring/SKILL.md) (plus the project's impact-analysis rules) | |
| Debugging a panic, deadlock, leak or wrong result | | [golang-troubleshooting](../golang-troubleshooting/SKILL.md) | |
| The Next.js frontend that calls the service | `nextjs-how-to` | | |
| Committing, worktrees, conflicts; MRs and the pipeline | `git-how-to`, `gitlab-how-to` | | |
| Writing or changing a skill or rule, vendoring or absorbing an upstream skill, the skills lint | `agent-skills-authoring` | | |

A new endpoint loads `go-project-layout` (where the handler, rule and query go) → `go-http-handlers` → `go-database` → `go-nextjs-api-contract` (the shape it answers) → `go-testing`, then each skill's "Reviewing" section before the merge request. A review of a whole change goes skill by skill: a handler → `go-http-handlers`, `go-security`, `go-error-handling`; a query or repository → `go-database`, `go-security`; a worker or anything with `go` → `go-concurrency`; a new package → `go-project-layout`; a test → `go-testing`; everything → `go-code-style`.

## Rules every skill assumes

1. **The project wins.** Its `AGENTS.md`, `CLAUDE.md`, architecture docs and project skills override the team skills where they differ. The team skills override the vendored upstream `golang-*` skills.
   Upstream skills name each other as `samber/cc-skills-golang@golang-<topic>`: an absorbed one (error-handling, concurrency, database, testing, security, project-layout, code-style) is now `go-<topic>`; the others are the vendored `golang-<topic>` or not adopted (rule 9).
2. **Check the toolchain.** Read `go.mod` (`go` and `toolchain` lines) before using a language or standard-library feature; some advice depends on the version.
3. **Imports point one way**, enforced by a test, not by convention.
4. **Errors are wrapped with context and checked with `errors.Is`/`As`**; handlers never panic.
5. **Every outbound call and query carries a `context.Context` with a deadline.**
6. **The OpenAPI document is the contract**; handlers are tested against it.
7. **`gofmt`, `go vet` and the project's linters pass**; `go test ./...` passes, with `-race` in CI.
8. **CI is GitLab CI**, not GitHub Actions: upstream's Dependabot, GoReleaser, CodeQL and `golangci-lint-action` advice doesn't apply; the pipeline is in `gitlab-ci` (its Go child template). Upstream's `golang-continuous-integration` isn't vendored.
9. **Links to upstream skills that aren't vendored** (`samber/cc-skills-golang@golang-samber-*`, `-stretchr-testify`, `-continuous-integration`, `-grpc`, `-swagger`, `-graphql`, `-cli`, `-spf13-*`, `-uber-*`, `-google-wire`, `-popular-libraries`, `-how-to`, `-gopls`, `-pkg-go-dev`, `-stay-updated`) are skipped, and so are their install commands (`npx skills add`, `clawhub`).
10. **Review before a merge request** with the "Reviewing" section of each skill the change touches, and cite rule IDs in findings.

## Workflow

From `<module-root>` (the folder with `go.mod`):

```sh
gofmt -l .                 # must print nothing
go vet ./...
go test ./...              # with -timeout 30m on big suites; a timed-out run can leave DB servers behind
go build ./cmd/...
golangci-lint run          # when the project has a .golangci.yml; don't add one as a side effect
```

If the project has impact-analysis or code-graph rules (in `AGENTS.md`/`CLAUDE.md`), run them before editing a symbol and before committing.

## Changing the Go skills

Rules, prefixes, vendoring, updating and the skills lint follow `agent-skills-authoring`. Go specifics:

- A new topic gets its own team skill `go-<topic>`, not a section in an existing one, and a row above.
- When a vendored `golang-<topic>` covers the same topic as a team skill, absorb it (`agent-skills-authoring`, "Upstream skills"): add Samuel Berthe's copyright to the team skill's `LICENSE`, write its `UPSTREAM.md` in the absorbed form (see `go-testing`'s), delete the vendored folder, and add the name to rule 1 above.
- Don't edit a vendored `golang-*` skill. Where the team disagrees with one, put the difference in the team skill closest to its topic ("Team decisions"); for one with no team skill, in this skill's rules above.
