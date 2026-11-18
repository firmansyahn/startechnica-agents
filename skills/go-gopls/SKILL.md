---
name: go-gopls
description: "Use when navigating or changing Go code and the question is about the resolved build, not text: go to a definition, find every reference or implementation before changing a symbol, trace callers, search a symbol by name, read a package's public API, run diagnostics after an edit, rename, extract or inline safely, fill a struct or switch, format, generate a test. Covers reaching gopls, the Go language server, through its own MCP server (go_* tools), the harness's built-in language-server integration (Claude Code's LSP tool, OpenCode, oh-my-pi) or the gopls CLI, which to prefer, and the read and edit workflows. Absorbs samber/cc-skills-golang@golang-gopls, adapted to the team. Not for the refactoring method and its approval gates (go-refactoring), debugging a failure (go-troubleshooting) or a whole-tree vulnerability audit (go-security)."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go server projects. Needs the gopls binary (v0.20 or later) on PATH.
metadata:
  author: firmansyahn
  version: "0.2.0"
---

# gopls: semantic code intelligence for Go (team)

**Principle:** Ask the compiler's view, not the text: when a question is about types, references, implementations or call sites, gopls answers it for the resolved build, and grep only finds strings.

> **Absorbed.** This skill includes `samber/cc-skills-golang@golang-gopls` (MIT, Samuel Berthe; source and pinned commit in [UPSTREAM.md](UPSTREAM.md)), adapted to the team: the team's decisions come first and win, and "In depth" holds the upstream material, edited where the team decided otherwise. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill.

Related: [go-refactoring](../go-refactoring/SKILL.md) (the refactoring method, risk levels and sign-off gates that use these tools), [go-troubleshooting](../go-troubleshooting/SKILL.md) (tracing callers while debugging), [go-code-style](../go-code-style/SKILL.md) (renames and modernizing), [go-security](../go-security/SKILL.md) (`govulncheck` audits), [go-continuous-integration](../go-continuous-integration/SKILL.md) (the vulnerability gate in CI).

## Team decisions

1. **The project's own tooling answers first where it exists.** If `AGENTS.md` or `CLAUDE.md` names a code-graph or impact-analysis tool, run it for blast radius before a symbol edit and before committing ([go-refactoring](../go-refactoring/SKILL.md) decision 5); gopls then resolves types, implementations and call sites, and runs the diagnostics.
2. **Wiring gopls is the user's choice, not a side effect of a task.** Installing the binary, registering its MCP server, setting `ENABLE_LSP_TOOL` or installing the Claude Code plugin changes the user's machine or settings; ask first, and don't add any of it to the repository's files unless the user asks. When gopls isn't reachable, carry on with `go build ./...`, `go vet ./...` and careful search, and say which checks were not run.
3. **Pick the surface the harness has.** The MCP server is `gopls mcp` and works in any harness that can register an MCP server. The built-in language-server integration differs: Claude Code has the native `LSP` tool and its plugin; OpenCode and oh-my-pi run their own built-in `gopls` server and push diagnostics after edits, with no plugin. The settings for each (Claude Code, OpenCode, oh-my-pi) are in [references/harnesses.md](references/harnesses.md); for another harness, an entry in its own settings that launches `gopls mcp`. The CLI works everywhere, on Linux, macOS and Windows (Git Bash), and is the fallback of last resort.
4. **Clean diagnostics are not a finished change.** After the edit workflow below, the usual checks still run: `gofmt -l .`, `go vet ./...`, `go test` on the changed packages, and the full `go test ./...` with `-race` in CI ([go-how-to](../go-how-to/SKILL.md), "Rules every skill assumes", rule 7).
5. **A vulnerability report is reported, not fixed on the way.** The baseline `go_vulncheck` at session start lists what the workspace already carries; tell the user what it found. Upgrading a dependency is its own change; the CI gate and the whole-tree audit are in [go-continuous-integration](../go-continuous-integration/SKILL.md) and [go-security](../go-security/SKILL.md).
6. **Refactors follow [go-refactoring](../go-refactoring/SKILL.md).** This skill says how to reach the tools; the plan, the risk levels, and the approval before touching code are that skill's. Prefer gopls rename and inline over hand edits, and treat a refused rename as a real conflict to investigate, not a tool bug.
7. Links to upstream skills that aren't absorbed (`samber/cc-skills-golang@golang-pkg-go-dev` and `-how-to`, and the rest in [go-how-to](../go-how-to/SKILL.md) rule 9) are skipped, and so are their install commands (`npx skills add`, `clawhub`). For a package outside the build (versions, licences, importers), read pkg.go.dev or the module's own repository.

## In depth

The material below is `samber/cc-skills-golang@golang-gopls`, absorbed into this skill (source, pinned commit and licence in [UPSTREAM.md](UPSTREAM.md)) and edited where the team decided otherwise. The team's decisions above win wherever the two still differ. Its reference files are in [references/](references/) (plus the team's [harnesses.md](references/harnesses.md), the setup for Claude Code, OpenCode and oh-my-pi): [mcp.md](references/mcp.md), [cli.md](references/cli.md), [matrix.md](references/matrix.md), [features.md](references/features.md), [settings.md](references/settings.md). Links of the form `samber/cc-skills-golang@<name>` name upstream skills: [go-how-to](../go-how-to/SKILL.md) (rule 1) maps each to the team skill that absorbed it.

**Persona:** You are a Go engineer who reaches for semantic code intelligence instead of grep whenever a question is about the resolved build — grep finds text, `gopls` finds meaning (types, call graphs, shadowing, implementation relationships).

**Dependencies:** `gopls` — `go install golang.org/x/tools/gopls@latest` (v0.20+; see team decision 2 before installing it). The native `LSP` tool additionally needs `ENABLE_LSP_TOOL=1` and the `gopls-lsp@claude-plugins-official` marketplace plugin (see [references/mcp.md](references/mcp.md)).

`gopls` is the official Go language server. It only answers questions about **your specific, locally resolved build** — your workspace plus every dependency exactly as pinned in `go.sum`, including `replace` directives. For a package that isn't part of that build (versions, docs, licenses, CVEs of something you haven't added yet), read pkg.go.dev or the module's repository instead.

### Three ways to reach gopls

Not interchangeable — pick by what you already know and what you need back:

- **gopls's own MCP server (preferred for most tasks)** — purpose-built for agents: tools take names, file paths, and fuzzy queries instead of raw cursor positions. Register once per machine: `claude mcp add gopls -- gopls mcp`. Runs headless over stdio, no editor attached, only sees files saved to disk — the right default for an agent-only workflow. See [references/mcp.md](references/mcp.md) for every tool.
- **The native `LSP` tool** — Claude Code's built-in editor-style integration. Off by default: set `ENABLE_LSP_TOOL=1`, install `gopls`, and install the official `gopls-lsp@claude-plugins-official` marketplace plugin to wire it as the Go language server. Operations (`goToDefinition`, `findReferences`, `hover`, `documentSymbol`, `workspaceSymbol`, `goToImplementation`, call hierarchy) are keyed by `line`/`character`, so they're most useful once you already have a location — typically right after a grep or a read. Unique value: compiler diagnostics are pushed into context automatically after every edit, no explicit call needed.
- **The `gopls` CLI** — same engine, invoked as `gopls <command> <file:line:col>`. The Go team documents it as experimental and debugging-only — "not efficient, complete, flexible, or officially supported." Use it when neither MCP nor the native tool is wired up, or for a one-shot scripted check. Positions are `file:line:col` (1-indexed, UTF-8 bytes) or `file:#offset` (0-indexed). See [references/cli.md](references/cli.md).

**Preference order: MCP → native `LSP` → CLI.** MCP tools match how an agent thinks (by name/path, not cursor position); the native tool adds free automatic diagnostics; the CLI is the documented fallback of last resort. Wire as many as are available and let the task pick the tool — a query you already have a `line:col` for is cheap via `LSP`, a "where is X" query is cheap via `go_search`, a quick unattended check is cheap via the CLI.

### Capability → CLI → MCP → native LSP

Full mapping of every capability to its CLI command, MCP tool, and native `LSP` op: [references/matrix.md](references/matrix.md).

### Use cases

- **Navigation** — jump to a definition, an implementation, or trace a call graph before touching code you didn't write. Details: [references/features.md](references/features.md#navigation).
- **Code discovery** — learn a workspace's shape (`go_workspace`), fuzzy-search a symbol you can't place exactly (`go_search`), or read a dependency's public surface (`go_package_api`) before using it.
- **Documentation** — hover for type/doc/size info, signature help while calling a function, or browse rendered package docs (`source.doc`, including internal packages pkg.go.dev never sees).
- **Diagnostics & safety** — compiler and analyzer errors after every edit (`go_diagnostics` / automatic with `LSP`), plus a lightweight `go_vulncheck` reachability check: once as a baseline right after detecting the workspace, and again after any `go.mod` change.
- **Formatting** — canonical `gofmt`-equivalent formatting and import organization, both scriptable and code-action-driven.
- **Refactoring** — safe rename (blocks a change that would break interface satisfaction), extract/inline, and the full `refactor.rewrite.*` family (fill struct/switch, invert if, split/join lines, remove unused parameter, add struct tags, implement interface). Full catalog with gotchas: [references/features.md](references/features.md#transformation).

### Efficient workflows

These Read/Edit workflows encode the order that avoids redundant queries and half-applied edits — treat every step as required, not optional, even to save a round trip.

- **Session start** — call `go_workspace` once to detect whether this is a Go workspace at all; if it is, immediately follow with a baseline `go_vulncheck` to surface vulnerabilities the workspace already carries (report them, team decision 5). This is unconditional, separate from the edit workflow's later check after a dependency change.

**Read workflow** (understand before touching anything):

1. `go_workspace` — layout (module/workspace/GOPATH); same call as the session-start check above if it hasn't run yet.
2. `go_search` — fuzzy-locate a type/function/variable by name.
3. `go_file_context` — right after reading any Go file for the first time, see what it pulls in from the rest of its package; re-run if that file's dependencies change.
4. `go_package_api` — a third-party dependency's or sibling package's public surface, without reading every file.

**Edit workflow** (iterate until diagnostics are clean):

1. Read first (workflow above).
2. `go_symbol_references` before modifying any definition — judge the blast radius, then read every referencing file that needs a matching edit.
3. Make all planned edits, including the reference-site edits, before moving on.
4. `go_diagnostics` on every changed file — mandatory after each modification, not an optional cleanup pass.
5. Fix reported errors: review any suggested quick-fix diff before applying, then re-run diagnostics to confirm the fix landed. Ignore hint/info diagnostics unrelated to the task. A diagnostic message can paraphrase the surrounding source rather than quote it verbatim.
6. Only if `go.mod` dependencies changed, run `go_vulncheck` on the whole workspace — after diagnostics are clean, not before.
7. Run `go test <changed-package-paths>` — not `./...` unless explicitly asked, since a full-repo run slows the iteration loop.

**Gotchas worth knowing before you rely on a result:**

- `references` results only reflect the **build configuration of the queried file** — a query on `foo_windows.go` will not surface matches in `bar_linux.go`; re-run under the relevant `GOOS`/build tags if a cross-platform result is missing.
- `call_hierarchy` only shows **static** calls — calls through function values or interface methods are invisible to it; corroborate with `references` when the call site matters.
- Extract/inline refactors are less rigorous than rename: comments are sometimes dropped, and generated files marked `DO NOT EDIT` receive no code actions at all.
- `refactor.rewrite.fillStruct` searches only the current file above the cursor and needs the struct's package already imported — run `source.organizeImports` first if the type was just typed in.

### gopls vs pkg.go.dev vs govulncheck

`gopls` only reasons about code present and resolvable in the local build:

- For anything not tied to that build (version history, license, ecosystem-wide importers, CVEs of a package not yet added) → read pkg.go.dev or the module's repository; no local checkout is needed.
- For a comprehensive, whole-tree vulnerability audit (CI gates, periodic sweeps) rather than gopls's lightweight on-demand `go_vulncheck` → [go-security](../go-security/SKILL.md) and [go-continuous-integration](../go-continuous-integration/SKILL.md) (`govulncheck`).
