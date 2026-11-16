---
name: go-continuous-integration
description: "Use when setting up, improving, or reviewing CI for a Go project: wiring tests, lint, module checks, vulnerability scans, coverage, dependency updates, release builds, or container builds. The Go-specific quality gates are here; GitLab pipeline syntax, workflow rules, shared templates, and pipeline debugging are in gitlab-ci. Adapted from samber/cc-skills-golang@golang-continuous-integration."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode, oh-my-pi or similar harness, and for Go projects using GitLab CI.
metadata:
  author: firmansyahn
  version: "0.1.1"
---

# Go continuous integration (team)

**Principle:** CI gives repeatable, blocking evidence that Go code builds, tests, and passes the project's quality and security checks.

> **Absorbed.** This skill includes `samber/cc-skills-golang@golang-continuous-integration` (MIT, Samuel Berthe; source and pinned commit in [UPSTREAM.md](UPSTREAM.md)), adapted to the team's GitLab CI and Go service conventions. The project's own `AGENTS.md`, `CLAUDE.md` and project skills win over this skill.

Related: [go-testing](../go-testing/SKILL.md) (test design and isolation), [go-code-style](../go-code-style/SKILL.md) (formatting and lint), [go-security](../go-security/SKILL.md) (security findings), [go-project-layout](../go-project-layout/SKILL.md) (modules and dependencies), [gitlab-ci](../gitlab-ci/SKILL.md) (GitLab pipeline structure, templates and debugging), [go-how-to](../go-how-to/SKILL.md) (shared Go assumptions).

## When to use

- Adding or changing Go checks in CI
- Choosing Go versions and test commands for a pipeline
- Adding module consistency or vulnerability checks
- Reviewing a Go pipeline's quality gates, caching, or release path
- Deciding whether a Go service needs container builds or binary releases

## Team decisions

1. **GitLab CI is the pipeline platform.** This skill selects Go checks; [gitlab-ci](../gitlab-ci/SKILL.md) owns the GitLab syntax, pipeline topology, shared templates, and CI debugging.
2. **Read `go.mod` first.** Use its `go` and `toolchain` directives to select the CI toolchain. Test the minimum Go version the project supports and its current supported version when compatibility across versions is part of the contract; do not copy a stale upstream version matrix.
3. **Quality checks block the merge.** Run formatting, `go vet`, the configured `golangci-lint`, and tests with `-race`. Keep the checks in the same test job where practical so compiled packages are reused; [gitlab-ci](../gitlab-ci/SKILL.md) defines the project's sharding and cache policy.
4. **Shuffle tests and disable result caching for integration tests.** `-shuffle=on` helps reveal order dependencies. Use `-count=1` when tests depend on external services or state that Go's test cache cannot observe; this disables test-result caching, not the Go build cache.
5. **Keep module files reproducible.** CI runs `go mod tidy` and fails if it changes `go.mod` or `go.sum`. `go mod verify` checks downloaded module contents.
6. **Run `govulncheck` in CI.** It reports known vulnerabilities reachable through the code's call paths. Interpret and fix findings with [go-security](../go-security/SKILL.md); do not substitute a generic dependency-version audit for this check.
7. **GitLab CI owns service releases.** Go services use the GitLab image and chart-release path in [gitlab-ci](../gitlab-ci/SKILL.md). GoReleaser is not the default for services; use it only when a project intentionally publishes Go binaries or library releases.
8. **Do not import GitHub Actions assets.** GitHub-specific workflow permissions, Dependabot, CodeQL, Codecov actions, Renovate app setup, Docker Hub/GHCR release workflows, and AI-review workflows are not the team's pipeline defaults. Use the platform-neutral principle only where it fits, then follow the team's GitLab skills and templates.

## Rules

One file per rule in `rules/`; the file name is the rule ID. Sections: [rules/_sections.md](rules/_sections.md).

| ID | Rule | Impact | Check |
|---|---|---|---|
| [goci-module-manifest-check](rules/goci-module-manifest-check.md) | Fail CI when `go mod tidy` changes module files | MEDIUM | ci, review |
| [goci-integration-tests-uncached](rules/goci-integration-tests-uncached.md) | Disable test-result caching for integration tests | MEDIUM | ci, review |
| [goci-vulncheck](rules/goci-vulncheck.md) | Run govulncheck in Go CI | HIGH | ci, review |

## Reviewing

1. **Read the project first:** inspect `go.mod`, its existing pipeline files, the configured linters, and any project-specific CI instructions.
2. **Check the Go gates:** module consistency, `go mod verify`, formatting, `go vet`, configured lint, `go test -race`, `govulncheck`, and `-count=1` on integration tests.
3. **Check pipeline behavior** with [gitlab-ci](../gitlab-ci/SKILL.md): required jobs run automatically and block the merge; build/release jobs wait for checks; CI caches build artifacts without reusing stale test results.
4. **Don't infer a missing gate from its name.** Inspect the merged GitLab configuration when shared templates or `extends` affect a job.
5. **Report** findings in the [agent-skills-authoring](../agent-skills-authoring/SKILL.md) format, ordered by impact. Name any check the project's pipeline does not yet run.

## Review checklist

- [ ] CI Go version follows the module's declared support
- [ ] Formatting, vet, configured lint, and race-enabled tests are required checks
- [ ] Integration tests that rely on external state use `-count=1`
- [ ] CI verifies module manifests after `go mod tidy` and verifies downloaded modules
- [ ] `govulncheck` runs, and its findings are handled with [go-security](../go-security/SKILL.md)
- [ ] GitLab release/build jobs use the team's templates rather than copied GitHub Actions

## In depth

The material below is adapted from `samber/cc-skills-golang@golang-continuous-integration` (source and pinned commit in [UPSTREAM.md](UPSTREAM.md)). The team's GitLab CI decisions above win wherever the upstream assumes GitHub Actions.

### Go test and build checks

Run CI on the minimum Go version the project claims to support, and on the current supported toolchain where a compatibility matrix is useful. Take versions from `go.mod`; a matrix should test declared compatibility, not every released Go version. Test failures should remain visible across the matrix instead of cancelling other versions unnecessarily.

Use the race detector in CI, and use `-shuffle=on` to surface hidden test-order dependencies. Generate coverage data when it is used for reporting or regression analysis; set a threshold only when the project has chosen and can maintain a meaningful one. `go mod tidy` followed by a diff check catches manifests that were not committed consistently. Keep integration tests connected to their real services as [go-testing](../go-testing/SKILL.md) requires, and pass `-count=1` when external service state makes a cached result unsafe.

### Lint and vulnerability analysis

Run the project's configured `golangci-lint` and `go vet` in CI. Do not add a linter configuration as a side effect of a pipeline change; use [go-code-style](../go-code-style/SKILL.md) for the team's configuration and lint choices.

Run `govulncheck` against the module. Its call-path analysis helps distinguish reachable vulnerabilities from vulnerable packages that the program does not use. Use [go-security](../go-security/SKILL.md) to assess the findings; CI wiring does not replace security review, and adding multiple overlapping scanners is not a substitute for handling results.

### Dependencies and releases

Automated dependency updates belong to the repository's chosen host and dependency policy. Group routine updates where that reduces review noise, but keep major upgrades reviewable; use [go-project-layout](../go-project-layout/SKILL.md) for module and dependency decisions. Never add a GitHub-only bot configuration to a GitLab project merely because it appears in upstream material.

For Go services, GitLab CI builds and releases the service image through the team's shared templates. A project that publishes standalone executables may choose GoReleaser, with an explicit release trigger and least-privilege credentials. A library may not need a release binary at all.

### Container and repository automation

Use the project's GitLab container pipeline and registry. A local image build is a separate workflow and does not require CI image builders. Apply the repository's GitLab branch protection, secrets, and pipeline permissions through [gitlab-mr](../gitlab-mr/SKILL.md) and [gitlab-ci](../gitlab-ci/SKILL.md); do not copy GitHub repository settings or workflow permission blocks.

AI code review is an explicit project choice, not a default CI job. The generated GitHub Actions reviewer assets from upstream are not portable to this team's GitLab pipeline and are not included.
