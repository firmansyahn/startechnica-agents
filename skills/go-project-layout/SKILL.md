---
name: go-project-layout
description: "Use when starting a Go service, adding, moving, renaming or splitting a package, deciding where code belongs, wiring dependencies, or reviewing a Go diff for layering: the official Go server-project layout (cmd/<binary>, internal/, one go.mod, no pkg/ or util packages), layers with imports pointing one way (Root, Surface, Domain, Platform, Kernel) and an architecture test that enforces them, thin main with run() error, dependencies passed to constructors by hand, no init() side effects, no replace or go.work to another checkout. Absorbs samber/cc-skills-golang@golang-project-layout, adapted to the team (no DI containers, no pkg/); the vendored golang-dependency-injection, golang-dependency-management and golang-design-patterns stay the depth for their topics, and this skill wins where they differ. Holds the layer-* rules."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode or similar harness, and for Go server projects.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# Go project layout and layers (team)

> **Absorbed.** This skill includes `samber/cc-skills-golang@golang-project-layout` (MIT, Samuel Berthe; source and pinned commit in [UPSTREAM.md](UPSTREAM.md)), adapted to the team: the team's rules and decisions come first and win, and "In depth" holds the upstream material, edited where the team decided otherwise. For depth on the neighbouring topics read the vendored [golang-dependency-injection](../golang-dependency-injection/SKILL.md), [golang-dependency-management](../golang-dependency-management/SKILL.md) and [golang-design-patterns](../golang-design-patterns/SKILL.md); this skill wins where they differ. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill.

Sources, in this order of authority:

1. **Official Go module layout** (`go.dev/doc/modules/layout`): the "server project" shape. Binding.
2. **golang-standards/project-layout**: community conventions, *not* an official Go standard. Used only to name directories; most of it doesn't apply to a server.

The project's own rules (`AGENTS.md`, `CLAUDE.md`, an architecture doc, an architecture test) win over both. Details: [references/module-layout.md](references/module-layout.md) (module, directories, layers, where code goes, the worker and `main` shapes).

Related: [go-code-style](../go-code-style/SKILL.md), [go-concurrency](../go-concurrency/SKILL.md) (worker lifecycle), [go-knadh-koanf](../go-knadh-koanf/SKILL.md) (the config package), [go-nextjs-api-contract](../go-nextjs-api-contract/SKILL.md) (the API document under `api/`), [go-how-to](../go-how-to/SKILL.md) (the Go skills and the rules they all assume).

## When to use

- Starting a new Go service, or adding a binary
- Adding, moving, renaming or splitting a package; deciding where new code goes
- Wiring a new dependency into the service
- A build that fails the architecture test, or an import that points the wrong way

## 1. Module and layout

- **Find `<module-root>` first:** the folder with `go.mod`. It is the repo root for a Go-only repo, or a subfolder (`server/`, `api/`) when the repo also holds a web app, deploy files or docs. The module path is where the repo is hosted (`<host>/<group>/<repo>`, plus the subfolder if the module isn't at the root).
- **One module.** Don't add nested `go.mod` files. Code another repo must reuse becomes its own module, never a `pkg/` folder.
- **Server project shape:** binaries in `cmd/<binary>/` (`package main`), all logic in `internal/`. Nothing is exported to other modules, and `internal/` makes the compiler enforce that.
- **No `pkg/`, `src/` or `vendor/`, and no `util`/`common`/`shared`/`lib`/`helpers`/`base`/`types` package.**
- `cmd/<binary>` stays thin: flags, config load, wiring, signals, shutdown. Business logic never goes in `package main`. A larger service moves the wiring to `internal/app` (the composition root).
- Packages are flat under `internal/<name>/`; nest only for a real sub-package (`database/dbtest`).
- Test fixtures go in a package-local `testdata/` (ignored by the Go tool).
- Generated files start with `// Code generated ... DO NOT EDIT.` and are never hand-edited; change the generator and rerun it.
- The API document under `api/` is generated from the route table and tested against handler replies ([go-nextjs-api-contract](../go-nextjs-api-contract/SKILL.md)).
- Don't create empty directories "for the layout".

## 2. Layers: imports point down only

Root → Surface → Domain → Platform → Kernel. A package may import its own layer's packages only where the project allows it, and never a layer above.

| Layer | Holds | Server-side HTTP types (`http.ResponseWriter`, `http.Handler`, `ServeMux`) |
|---|---|---|
| Root | `cmd/<binary>`, `internal/app`: flags, config, wiring, lifecycle | yes |
| Surface | HTTP/gRPC handlers, one package per API surface (`internal/api/<surface>/<area>`), translating requests to Domain calls | yes |
| Domain | Business rules, use cases, vendor clients, pollers, background jobs (`internal/<feature>`) | **no**; an outbound `http.Client` is fine |
| Platform | Database access and schema, config loading, health, shared HTTP plumbing (envelopes, middleware, routing helpers) | only the HTTP plumbing packages |
| Kernel | Pure entities, value types and rules; standard library only | no |

- New code goes into Domain + Surface. A package that both serves HTTP and holds business rules is a legacy "slice"; new work splits it instead of growing it.
- If the project has an **architecture test** (a `go test` that classifies every package into a layer and checks imports), every new package needs its classification entry or the build fails. Don't add exceptions to its allowlists; remove an entry when you fix its violation.
- No architecture test yet? Keep the rule anyway and suggest one to the user: a test that runs `go list -deps -json ./...`, maps each package to a layer and fails on an upward import.

## 3. Wiring and lifecycle

- **No mutable package globals.** Constructors take dependencies explicitly: `NewService(db *database.DB, log *slog.Logger) *Service`. Inject clocks (`now func() time.Time`) instead of patching globals in tests.
- Past about four dependencies, or with optional ones, use a deps struct or functional options instead of a longer parameter list.
- **No `init()` with I/O, env reads or goroutines.**
- **`main` calls `run() error`** and is the only place that exits ([go-error-handling](../go-error-handling/SKILL.md)); shutdown order is in [go-concurrency](../go-concurrency/SKILL.md).

## Team decisions

1. **No DI containers.** Dependencies are passed to constructors by hand (`layer-inject-dependencies`); `google/wire`, `uber-go/dig`, `uber-go/fx` and `samber/do` are not adopted, whatever golang-dependency-injection recommends.
2. **No `pkg/`.** These are server projects: golang-project-layout's "library" and "CLI with optional `pkg/`" shapes don't apply (`layer-logic-in-internal`).
3. **No `replace` or `go.work` pointing at another checkout** (a sibling repo or another worktree); golang-dependency-management's `replace` advice is for a fork published as its own module (`git-worktree`, `wt-own-dependencies`).
4. **Dependency upgrades** follow golang-dependency-management, but CI is GitLab CI (`gitlab-ci`): Dependabot and Renovate-on-GitHub advice doesn't apply.

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [layer-imports-point-down](rules/layer-imports-point-down.md) | Import only downward through the layers | MEDIUM | test (architecture test) |
| [layer-inject-dependencies](rules/layer-inject-dependencies.md) | Inject dependencies; no mutable package globals | MEDIUM | scan (candidates), lint (gochecknoglobals) |
| [layer-no-init-side-effects](rules/layer-no-init-side-effects.md) | No I/O, env reads or goroutines in init() | MEDIUM | scan, lint (gochecknoinits) |
| [layer-logic-in-internal](rules/layer-logic-in-internal.md) | Logic in internal/, thin cmd/, no pkg/ or util packages | LOW | scan |

## Reviewing

1. **Scope:** the diff (`git diff <base>...HEAD -- '*.go'`), a merge request's files, or the whole module.
2. **Tools first**, from `<module-root>`: `gofmt -l .`, `go vet ./...`, and `golangci-lint run` when the project has a `.golangci.yml`. Report their findings as they are; a rule that names a linter isn't reported twice.
3. **Scan:** `bash <this skill>/scripts/scan.sh <module-root>` lists candidates for the rules with `scan` in their check. On a diff, keep the ones in changed lines; open the rule and confirm each before reporting it.
4. **Read** the code against the rules above, matching each rule's "Incorrect" shape, not just its title, and against the checklist below.
5. **Report** in the format of `agent-skills-authoring` ("Scan scripts and findings"), ordered by impact; list once, as a gap, the rules whose check is a test or linter the project doesn't have.

## Review checklist

- [ ] Logic in `internal/`, not `cmd/`; no `pkg/`, `util`-style package or nested `go.mod`
- [ ] Imports point down the layers; no server-side HTTP types in Kernel, Domain or the database package
- [ ] New package classified if there is an architecture test
- [ ] Dependencies injected through constructors; no new mutable globals; no `init()` side effects
- [ ] No `replace`/`go.work` to another checkout

## In depth

The material below is `samber/cc-skills-golang@golang-project-layout`, absorbed into this skill (source, pinned commit and licence in [UPSTREAM.md](UPSTREAM.md)) and edited where the team decided otherwise. The team's rules and decisions above win wherever the two still differ. Links of the form `samber/cc-skills-golang@<name>` name upstream skills: the ones absorbed are now team skills (`go-how-to` maps the names), the rest are vendored as `golang-*` or not adopted.

**Persona:** You are a Go project architect. You follow the team's server layout and layers (sections 1-3 above) and right-size within them — no empty directories "for the layout", no package until there is code for it.

**Questions:** Ask the user through the environment's question tool — never as plain-text prose. The architecture and the DI approach are already decided (sections 1-3 and "Team decisions"), so don't ask about them; ask only about what the project hasn't settled, such as the binary name or the module path.

### Architecture: Decided

The architecture is the team's: the official Go server-project layout (`cmd/<binary>/`, all logic in `internal/`, one `go.mod`) with the layers Root, Surface, Domain, Platform and Kernel, imports pointing down only (section 2). Don't ask the developer to choose between clean architecture, hexagonal, DDD or a flat structure, and don't impose a different one. If the project's own architecture doc or architecture test says more, follow it.

→ See `golang-design-patterns` skill for detailed architecture guides with file trees and code examples; where they differ from the layers above, the layers win.

### Dependency Injection: By Hand

Dependencies are wired by hand: constructors take them explicitly, and `cmd/<binary>` (or `internal/app` in a larger service) builds them in order and owns lifecycle (health checks, graceful shutdown) (section 3, `layer-inject-dependencies`). No DI library: `samber/do`, `google/wire`, `uber-go/dig` and `uber-go/fx` are not adopted, so don't offer them as a choice. See the `golang-dependency-injection` skill for constructor-injection patterns; its library comparison doesn't apply.

### 12-Factor App

For applications (services, APIs, workers), follow [12-Factor App](https://12factor.net/) conventions: config kept out of the code, logs to stdout, stateless processes, graceful shutdown, backing services as attached resources, and admin tasks as one-off commands (e.g., `cmd/migrate/`). The team's form of "config out of the code": one settings file loaded with koanf by `internal/config`, mounted by the deployment and never committed, with secrets as mounted `<name>_file` values (`go-knadh-koanf`).

### Quick Start: Choose Your Project Type

| Project Type | Use When | Key Directories |
| --- | --- | --- |
| **Service** | HTTP API, microservice, or web app | `cmd/{service}/`, `internal/`, `api/`; a frontend is a separate app in its own folder beside the module |
| **Tool binary** | A command-line tool, migration runner or data conversion for the service | its own `cmd/{name}/` in the same module, importing `internal/`; no `pkg/` |

Not team shapes: a service with public `pkg/{name}/` packages (code another repo must reuse becomes its own module in its own repo, with its public packages at the root; see the library layout in [directory layout examples](references/directory-layouts.md)), and a **multi-module monorepo or workspace** (`go.work`, `replace` directives): a project is one module, and `go.work` or `replace` never points at another checkout.

### Module Naming Conventions

#### Module Name (go.mod)

Your module path in `go.mod` should:

- **MUST match your repository URL**: `github.com/username/project-name`
- **Use lowercase only**: `github.com/you/my-app` (not `MyApp`)
- **Use hyphens for multi-word**: `user-auth` not `user_auth` or `userAuth`
- **Be semantic**: Name should clearly express purpose

**Examples:**

```go
// ✅ Good
module github.com/jdoe/payment-processor
module github.com/company/cli-tool

// ❌ Bad
module myproject
module github.com/jdoe/MyProject
module utils
```

#### Package Naming

Packages MUST be lowercase, singular, and match their directory name. → See `golang-naming` skill for complete package naming conventions and examples.

### Directory Layout

All `main` packages must reside in `cmd/` with minimal logic — parse flags, wire dependencies, call `Run()`. Business logic belongs in `internal/`. A server exports nothing, so there is no `pkg/`: `internal/` holds every package, and the compiler stops other modules importing it.

See [directory layout examples](references/directory-layouts.md) for the server, small-tool and own-repo library layouts, plus common mistakes.

### Essential Configuration Files

A Go project usually has at the module root:

- **Makefile** — build automation (upstream's template isn't vendored; follow the project's existing build entry point)
- **.gitignore** — git ignore patterns
- **.golangci.yml** — linter config. Don't add one, or change it, as a side effect of other work; if the project has none, propose one (see the `golang-lint` skill for the recommended configuration)

Settings are loaded with koanf by one `internal/config` package, not Cobra + Viper in `cmd/` (`go-knadh-koanf`); [config reference](references/config.md) keeps upstream's Viper notes for reading a project that already uses Viper.

### Tests, Benchmarks, and Examples

Co-locate `_test.go` files with the code they test. Use `testdata/` for fixtures. See [testing layout](references/testing-layout.md) for file naming, placement, and organization details.

### Go Workspaces

A team project is one module, so it has no `go.work`; never point `go.work` (or `replace`) at another checkout, a sibling repo or another worktree. [Workspaces](references/workspaces.md) keeps upstream's notes on `go.work` for reading a multi-module repository you don't own.

### Initialization Checklist

When starting a new Go project:

- [ ] Follow the team's server layout and layers (sections 1-3); the architecture is not a question for the developer
- [ ] Wire dependencies by hand through constructors; no DI library — see `golang-dependency-injection` skill for the constructor patterns
- [ ] One service per module; extra tools are more `cmd/{name}/` binaries in it
- [ ] Right-size the structure to the project scope (no empty directories)
- [ ] Choose module name (matches repo URL, lowercase, hyphens)
- [ ] Run `go version` to detect the current go version
- [ ] Run `go mod init <host>/<group>/<repo>` (add the subfolder when the module isn't at the repo root)
- [ ] Create `cmd/{name}/main.go` for entry point
- [ ] Create `internal/` for all other code (no `pkg/`)
- [ ] Add an architecture test that enforces the layers, or propose one (section 2)
- [ ] Run `gofmt -s -w .` to ensure formatting
- [ ] Add `.gitignore` with `/vendor/` and binary patterns

### Related Skills

- → See `golang-dependency-injection` skill for constructor-injection patterns and wiring (by hand; its DI libraries are not adopted).
- → See `golang-lint` skill for golangci-lint configuration (propose a config; don't add one as a side effect).
- → See `golang-design-patterns` skill for architectural patterns.
- → See `golang-refactoring` skill for safely moving or splitting existing code into the layout above via type-alias gradual code repair and staged PRs, without a big-bang break.
