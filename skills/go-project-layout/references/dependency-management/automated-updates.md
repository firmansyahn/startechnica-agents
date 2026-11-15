# Automated Dependency Updates

Automate minor/patch dependency updates to reduce maintenance burden and stay current with security fixes. This requires a solid CI pipeline — tests and linting must pass before any auto-merge.

## Update Bots

CI is GitLab CI, so the bot is one that opens merge requests on GitLab, such as Renovate (Dependabot is GitHub-only and doesn't apply). What to look for in its configuration:

| Feature | What to check |
| --- | --- |
| `go mod tidy` | Run after each update (Renovate: opt-in `gomodTidy`) |
| Automerge | Merges only after the pipeline passes |
| Grouping | Related modules updated in one merge request |
| Workspaces | Aware of `go.work` when the repository has one |
| Regex managers | Also updates versions in Dockerfiles, Makefiles, etc |

## Auto-Merge Strategy

- **Minor and patch updates**: Auto-merge only after the GitLab CI pipeline passes (tests + lint + govulncheck) and the package is low-risk for the project
- **Major updates**: Open a merge request for manual review (may contain breaking changes)
- **Security updates**: Auto-merge regardless of version bump type

The pipeline that gates these merge requests (jobs in `.gitlab-ci.yml`) is in the [gitlab-ci](../../../gitlab-ci/SKILL.md) skill.

## Update Verification

Before committing a dependency update:

0. Changelogs may suggest improvements applicable to the project.
1. Run `go test ./...` and `go build ./...`
2. Scan with `govulncheck ./...` or `go tool govulncheck ./...`
3. Release notes/changelogs for libraries that affect persistence, serialization, networking, authentication, authorization, cryptography, or public APIs may contain important information about breaking changes
4. Major version upgrades may contain breaking changes — the package's changelog documents them
5. New APIs or patterns introduced in the updated version may offer improvements worth considering
