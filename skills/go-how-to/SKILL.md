---
name: go-how-to
description: "Use at the start of any Go backend work when it isn't clear which skill applies, or when a task spans several: starting a service, adding an endpoint end to end, onboarding to the team's Go conventions, asking 'what are our rules for Go' or 'how do we do X in Go'. Routes to the focused team skills (go-project-layout, go-code-style, go-error-handling, go-concurrency, go-database, go-testing, go-continuous-integration, go-security, go-http-handlers, go-knadh-koanf, go-observability, go-performance, go-safety, go-data-structures, go-refactoring, go-troubleshooting), go-nextjs-api-contract and the OAuth skills, maps every samber/cc-skills-golang golang-* name to the team skill that absorbed it, says how to ask each harness for deep thinking or subagents, and lists the rules they all assume and the toolchain commands. Each skill reviews its own rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects.
metadata:
  author: firmansyahn
  version: "0.3.0"
---

# Go: which skill, and what they all assume

**Principle:** Route, don't teach: open the one skill the task needs, and let that skill decide.

This skill only routes: open the skill the task needs, and only that one. Each skill holds its patterns, its rules (one file per rule, indexed with how each is caught), its `scripts/scan.sh` and a "Reviewing" section.

The skills follow the samber/cc-skills-golang shape: one focused skill per topic, and this router in place of upstream's `golang-how-to`. The general Go material is [samber/cc-skills-golang](https://github.com/samber/cc-skills-golang) (MIT). Every upstream skill the team uses is **absorbed** into a team skill: `go-<topic>` holds the team's principle, rules and decisions first, and the upstream material, edited to agree, under "In depth" or as one of its references (its `UPSTREAM.md` gives the pinned commit). No `golang-*` skill is vendored; rule 1 maps their names.

**How to use it:** the skills are installed together, each in its own folder beside this one, wherever the project or user keeps skills; the links below are relative to this file, and a skill named in backticks is the folder of that name beside this one. Open the linked `SKILL.md` with Read (they may not be registered as invocable skills), then only the references and rules it points to.

## Pick the skill

| The task | Team skill | Upstream skills absorbed (as "In depth" or a reference) | Rules |
|---|---|---|---|
| Module layout, `cmd/` and `internal/`, where a package goes, the layers and their architecture test, wiring, `go.mod` and dependencies | [go-project-layout](../go-project-layout/SKILL.md) | golang-project-layout; golang-dependency-injection, golang-dependency-management, golang-design-patterns | `layer-` |
| Formatting, naming, structs and interfaces, time types, JSON tags, logging, doc comments, lint, modernizing | [go-code-style](../go-code-style/SKILL.md) | golang-code-style; golang-naming, golang-structs-interfaces, golang-documentation, golang-lint, golang-modernize | `style-` |
| Creating, wrapping, matching and logging errors; panics; exits | [go-error-handling](../go-error-handling/SKILL.md) | golang-error-handling | `err-` |
| Goroutines, workers, `context.Context`, deadlines, mutexes, channels, shutdown | [go-concurrency](../go-concurrency/SKILL.md) | golang-concurrency; golang-context | `conc-` |
| Queries, transactions, soft deletes, IDs, migrations, `pgx` | [go-database](../go-database/SKILL.md) | golang-database | `db-` |
| Unit, database and handler tests; `-race`, `t.Parallel`, flaky or slow tests | [go-testing](../go-testing/SKILL.md) | golang-testing | `test-` |
| Go CI quality gates: module checks, Go tests, lint and vulnerability scanning | [go-continuous-integration](../go-continuous-integration/SKILL.md) | golang-continuous-integration | `goci-` |
| Logs (zap), metrics, traces, profiling toggles, alerts, dashboards | [go-observability](../go-observability/SKILL.md) | golang-observability | |
| Authorization, SQL injection, secrets, TLS, paths, SSRF, a security review | [go-security](../go-security/SKILL.md) | golang-security | `sec-` |
| HTTP handlers and outbound HTTP calls: bodies, decoding, error statuses | [go-http-handlers](../go-http-handlers/SKILL.md) | (no upstream skill) | `api-` |
| Loading, adding, validating or testing settings (koanf) | [go-knadh-koanf](../go-knadh-koanf/SKILL.md) | (no upstream koanf skill; golang-spf13-viper not adopted) | |
| An endpoint's request and reply shape: envelope, status codes, field errors, pagination, OpenAPI | [go-nextjs-api-contract](../go-nextjs-api-contract/SKILL.md) | | `contract-` |
| Running an OAuth 2.1 authorization server, or calling one as a client | [oauth-server](../oauth-server/SKILL.md), [oauth-client](../oauth-client/SKILL.md) | | `oauth-`, `sec-oauth-` |
| Nil, zero values, overflow, aliasing, defer pitfalls | [go-safety](../go-safety/SKILL.md) | golang-safety | |
| Slices, maps, `container/*`, generic collections | [go-data-structures](../go-data-structures/SKILL.md) | golang-data-structures | |
| Allocation, CPU and latency work; benchmarks, profiles, benchstat | [go-performance](../go-performance/SKILL.md) | golang-performance; golang-benchmark | |
| Refactoring a package or API safely (plus the project's impact-analysis rules) | [go-refactoring](../go-refactoring/SKILL.md) | golang-refactoring | |
| Debugging a panic, deadlock, leak or wrong result | [go-troubleshooting](../go-troubleshooting/SKILL.md) | golang-troubleshooting | |
| The Next.js frontend that calls the service | `nextjs-how-to` | | |
| Committing, worktrees, conflicts; MRs and the pipeline | `git-how-to`, `gitlab-how-to` | | |
| Writing or changing a skill or rule, vendoring or absorbing an upstream skill, the skills lint | `agent-skills-authoring` | | |

A new endpoint loads `go-project-layout` (where the handler, rule and query go) → `go-http-handlers` → `go-database` → `go-nextjs-api-contract` (the shape it answers) → `go-testing`, then each skill's "Reviewing" section before the merge request. A review of a whole change goes skill by skill: a handler → `go-http-handlers`, `go-security`, `go-error-handling`; a query or repository → `go-database`, `go-security`; a worker or anything with `go` → `go-concurrency`; a new package → `go-project-layout`; a test → `go-testing`; a CI change → `go-continuous-integration`, `gitlab-ci`; everything → `go-code-style`.

## Rules every skill assumes

1. **The project wins.** Its `AGENTS.md`, `CLAUDE.md`, architecture docs and project skills override the team skills where they differ.
   Upstream skills name each other as `samber/cc-skills-golang@golang-<topic>`. Each one the team uses is absorbed; read the name as the team skill below. Any other name is not adopted (rule 9).

   | Upstream name | Team skill |
   |---|---|
   | `golang-code-style`, `golang-naming`, `golang-structs-interfaces`, `golang-documentation`, `golang-lint`, `golang-modernize` | `go-code-style` (the last five as `references/<topic>.md`) |
   | `golang-project-layout`, `golang-dependency-injection`, `golang-dependency-management`, `golang-design-patterns` | `go-project-layout` (the last three as `references/<topic>.md`) |
   | `golang-concurrency`, `golang-context` | `go-concurrency` (`references/context.md`) |
   | `golang-performance`, `golang-benchmark` | `go-performance` (`references/benchmark.md`) |
   | `golang-continuous-integration` | `go-continuous-integration` |
   | `golang-error-handling`, `-database`, `-testing`, `-security`, `-observability`, `-safety`, `-data-structures`, `-refactoring`, `-troubleshooting` | `go-<topic>` |
2. **Check the toolchain.** Read `go.mod` (`go` and `toolchain` lines) before using a language or standard-library feature; some advice depends on the version.
3. **Imports point one way**, enforced by a test, not by convention.
4. **Errors are wrapped with context and checked with `errors.Is`/`As`**; handlers never panic.
5. **Every outbound call and query carries a `context.Context` with a deadline.**
6. **The OpenAPI document is the contract**; handlers are tested against it.
7. **`gofmt`, `go vet` and the project's linters pass**; `go test ./...` passes, with `-race` in CI.
8. **CI is GitLab CI.** `go-continuous-integration` covers Go quality gates; `gitlab-ci` owns pipeline syntax, topology and shared templates. GitHub Actions, Dependabot, CodeQL and `golangci-lint-action` instructions are not copied as platform defaults.
9. **Links to upstream skills that aren't absorbed** (`samber/cc-skills-golang@golang-samber-*`, `-stretchr-testify`, `-grpc`, `-swagger`, `-graphql`, `-cli`, `-spf13-*`, `-uber-*`, `-google-wire`, `-popular-libraries`, `-how-to`, `-gopls`, `-pkg-go-dev`, `-stay-updated`) are skipped, and so are their install commands (`npx skills add`, `clawhub`).
10. **Review before a merge request** with the "Reviewing" section of each skill the change touches, and cite rule IDs in findings.

## Asking the harness for depth or subagents

Some skills say a task deserves the deepest reasoning ("Thinking mode") or parallel subagents ("Orchestration mode"). How to ask for it:

| Harness | Deepest reasoning | Subagents |
|---|---|---|
| Claude Code | `ultrathink` in the prompt | `ultracode` in the prompt (multi-stage workflows) |
| oh-my-pi | `ultrathink` in the prompt (highest supported effort for that turn); `shift+tab` cycles the thinking level | `orchestrate` in the prompt; `workflowz` for a deterministic multi-subagent workflow |
| OpenCode | the `max` (or `high`) model variant: `ctrl+t` cycles variants, `opencode run --variant max` for one run | ask the agent to delegate to subagents, or mention one (`@general`) |
| Codex | `high` reasoning effort or above: `/model`, or `-c model_reasoning_effort=high` | |

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
- A new upstream `golang-<topic>` the team wants is absorbed, never vendored (`agent-skills-authoring`, "Upstream skills"): into the team skill on its topic as `references/<topic>.md`, or as a new `go-<topic>` with its body under "In depth". Add Samuel Berthe's copyright to the `LICENSE`, its source and commit to `UPSTREAM.md`, and its name to rule 1 above.
- Updating to a newer upstream commit: diff upstream's folder between the two commits and port each change by hand, keeping the team's decisions (each `UPSTREAM.md` says where its files went).
