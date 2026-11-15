# startechnica-agents

Agent skills for building and shipping Go services and Next.js apps: one focused skill per topic, each with its rules (one file per rule, with how a violation is caught), a review section, a scan script for what can be checked mechanically, and a checklist. They follow the [Agent Skills](https://agentskills.io) format and work with Claude Code, Codex, Cursor, Gemini CLI, OpenCode and any other tool that reads `SKILL.md` folders.

Where an established public skill already covers a topic well, it is included unchanged (vendored) with its licence and an `UPSTREAM.md` naming its source and pinned commit, and a team skill adds what it leaves open.

## Install

**[skills](https://skills.sh) CLI** (any Agent Skills tool):

```sh
npx skills add https://github.com/firmansyahn/startechnica-agents --all
# or one skill:
npx skills add https://github.com/firmansyahn/startechnica-agents --skill go-testing
```

**Claude Code plugin:**

```
/plugin marketplace add firmansyahn/startechnica-agents
/plugin install startechnica-agents@startechnica
```

**Gemini CLI:** `gemini extensions install https://github.com/firmansyahn/startechnica-agents`

**By hand:** copy the folders under `skills/` into your tool's skills folder (`~/.claude/skills/`, a project's `.claude/skills/` or `.agents/skills/`, ...). Install them together: the skills name each other and the routers expect their siblings beside them.

## Where to start

Each area has a small router skill that sends a task to the right skill and lists what all of them assume. Start there when unsure which skill applies.

| Area | Router | Topic skills |
|---|---|---|
| Go services | `go-how-to` | `go-project-layout`, `go-code-style`, `go-error-handling`, `go-concurrency`, `go-database`, `go-testing`, `go-security`, `go-http-handlers`, `go-knadh-koanf`, `go-nextjs-api-contract` |
| Next.js apps | `nextjs-how-to` | `nextjs-new-app`, `nextjs-app-structure`, `nextjs-data`, `nextjs-bff`, `nextjs-forms`, `nextjs-ui`, `nextjs-logging`, `nextjs-security`, `nextjs-e2e`, `nextjs-deploy`, `nextjs-package-manager` |
| OAuth / OIDC | (from `go-how-to`, `nextjs-how-to`) | `oauth-server`, `oauth-client` |
| git | `git-how-to` | `git-worktree`, `git-commit`, `git-gitignore` |
| GitLab | `gitlab-how-to` | `gitlab-mr`, `gitlab-ci` |
| Writing these skills | `agent-skills-authoring` | the rule format, rule prefixes, vendoring upstream skills, the skills lint |
| Releasing the skills | `agent-skills-release` | the bump kind, the version script, tagging and the GitHub release |

## Vendored upstream skills

Included unchanged, each under its own licence (see its `LICENSE` and `UPSTREAM.md`):

| Skills | Source | Licence |
|---|---|---|
| `golang-benchmark`, `golang-context`, `golang-data-structures`, `golang-dependency-injection`, `golang-dependency-management`, `golang-design-patterns`, `golang-documentation`, `golang-lint`, `golang-modernize`, `golang-naming`, `golang-observability`, `golang-performance`, `golang-refactoring`, `golang-safety`, `golang-structs-interfaces`, `golang-troubleshooting` | [samber/cc-skills-golang](https://github.com/samber/cc-skills-golang) | MIT |
| `next-dev-loop`, `next-bundle-optimizer` | [vercel/next.js](https://github.com/vercel/next.js/tree/canary/skills) | MIT |
| `git-using-worktrees`, `finishing-a-development-branch` | [obra/superpowers](https://github.com/obra/superpowers) | MIT |
| `git-resolve-conflicts` | [tailcallhq/forgecode](https://github.com/tailcallhq/forgecode) | Apache-2.0 |
| `gitlab-glab`, `gitlab-mr-description`, `git-mr-adversarial-review`, `gitlab-pipeline-watch`, `gitlab-babysit-mr`, `gitlab-stacked-mrs` | [gitlab-org/ai/skills](https://gitlab.com/gitlab-org/ai/skills) | MIT |
| `gitlab-ci-skill` | [gitlab-org/ci-cd/gitlab-ci-skill](https://gitlab.com/gitlab-org/ci-cd/gitlab-ci-skill) | MIT |

Seven of samber's Go skills (project layout, code style, error handling, concurrency, database, testing, security) are absorbed into the matching `go-<topic>` skill, under "In depth", with both copyrights in its `LICENSE`.

## Reviewing with the skills

Every skill with rules has a "Reviewing" section. Skills whose rules a script can catch also have `scripts/scan.sh`, which prints candidates as `<rule-id>\t<where>: <text>` (POSIX tools only; Linux, macOS, Git Bash on Windows), for example:

```sh
bash skills/go-security/scripts/scan.sh path/to/module
bash skills/git-commit/scripts/scan.sh origin/main
```

Every line is a candidate: open the rule file and confirm it before reporting.

## Checking the skills

```sh
node skills/agent-skills-authoring/scripts/lint-skills.mjs
```

It checks frontmatter, licences, upstream records, links and anchors, rule files and IDs, that every skill is routed, that no skill hard-codes an install path, and LF line endings. CI runs it on every push and pull request. Before publishing a fork elsewhere, set `SKILLS_INTERNAL_PATTERNS` to a regex of your organisation's own names to catch any that slipped into an example.

## Licence

[MIT](LICENSE) for the team skills. Vendored skills keep their own licences, named above and in each skill's folder.
