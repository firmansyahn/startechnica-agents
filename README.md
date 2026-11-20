# startechnica-agents

Agent skills for building and shipping Go services and Next.js apps: one focused skill per topic, each with its rules (one file per rule, with how a violation is caught), a review section, a scan script for what can be checked mechanically, and a checklist. They follow the [Agent Skills](https://agentskills.io) format and work with Claude Code, Codex, Cursor, Gemini CLI, OpenCode, oh-my-pi and any other tool that reads `SKILL.md` folders.

Where an established public skill already covers a topic well, it is either included unchanged (vendored) with its licence and an `UPSTREAM.md` naming its source and pinned commit, with a team skill adding what it leaves open, or absorbed into a team skill and edited to agree with the team.

## How to use

**Install with the [skills](https://skills.sh) CLI** (works with any [Agent Skills](https://agentskills.io) tool):

```sh
npx skills add https://github.com/firmansyahn/startechnica-agents --all
# or one skill:
npx skills add https://github.com/firmansyahn/startechnica-agents --skill go-testing
```

**Update** the same way. `update` moves installed skills to the latest release; `add --all` also installs the skills a release adds, and `remove` drops the ones it deletes (see [Updating](#updating)).

```sh
npx skills update          # -p for the project's skills, -g for the global ones, -y to skip the prompt
npx skills add https://github.com/firmansyahn/startechnica-agents --all
```

Skills name each other and the routers expect their siblings beside them, so install them together.

<details>
<summary>Claude Code</summary>

```
/plugin marketplace add firmansyahn/startechnica-agents
/plugin install startechnica-agents@startechnica
```

Update, then restart the session:

```
/plugin marketplace update startechnica
/plugin update startechnica-agents@startechnica
```

From a terminal: `claude plugin marketplace update startechnica` and `claude plugin update startechnica-agents@startechnica`.

</details>

<details>
<summary>Gemini CLI</summary>

```sh
gemini extensions install https://github.com/firmansyahn/startechnica-agents
```

Update with `gemini extensions update startechnica-agents`.

</details>

<details>
<summary>OpenClaw</summary>

Install globally:

```sh
git clone https://github.com/firmansyahn/startechnica-agents.git ~/.openclaw/skills/startechnica-agents
```

Or install in the OpenClaw workspace:

```sh
git clone https://github.com/firmansyahn/startechnica-agents.git ~/.openclaw/workspace/skills/startechnica-agents
```

Update the global copy:

```sh
git -C ~/.openclaw/skills/startechnica-agents pull
```

Or update the workspace copy:

```sh
git -C ~/.openclaw/workspace/skills/startechnica-agents pull
```

</details>

<details>
<summary>Copilot</summary>

Install personal skills:

```sh
git clone https://github.com/firmansyahn/startechnica-agents.git ~/.copilot/skills/startechnica-agents
```

For project skills, clone into `.agents/skills/startechnica-agents` in the project. Update with `git -C .agents/skills/startechnica-agents pull`.

</details>

<details>
<summary>oh-my-pi</summary>

Install through oh-my-pi's plugin marketplace:

```sh
omp plugin marketplace add firmansyahn/startechnica-agents
omp plugin install startechnica-agents@startechnica
```

Update the marketplace and installed plugin with:

```sh
omp plugin marketplace update startechnica
omp plugin upgrade startechnica-agents@startechnica
```

By default, the plugin is installed for the user. To install it for the current project, add `--scope project` to the `omp plugin install` command.

</details>

<details>
<summary>Cursor and OpenCode skills</summary>

Clone into the shared Agent Skills directory:

```sh
git clone https://github.com/firmansyahn/startechnica-agents.git ~/.agents/skills/startechnica-agents
```

For a project-local install, clone into `.agents/skills/startechnica-agents`. Cursor can alternatively use `~/.cursor/skills/` or `.cursor/skills/`; OpenCode can use `~/.opencode/skills/`, `.opencode/skills/` or `.claude/skills/`.

To install specifically for Cursor, use one of these destinations instead of the shared directory:

```sh
git clone https://github.com/firmansyahn/startechnica-agents.git ~/.cursor/skills/startechnica-agents
# or in a project:
git clone https://github.com/firmansyahn/startechnica-agents.git .cursor/skills/startechnica-agents
```

Update the shared clone with `git -C ~/.agents/skills/startechnica-agents pull`, or check out `v<version>` to stay on a release.

</details>

<details>
<summary>OpenCode plugin</summary>

OpenCode discovers `SKILL.md` files natively. The optional plugin adds a slash command for every skill and a tool for listing, searching and loading skill instructions.

Install the plugin from Git with OpenCode v2.3.0 or a compatible release (requires a revision containing the [root npm manifest](package.json)):

```sh
opencode plugin add 'git+https://github.com/firmansyahn/startechnica-agents.git'
```

For a local installation instead, clone this repository (or reuse the clone from the OpenCode skills section):

```sh
git clone https://github.com/firmansyahn/startechnica-agents.git ~/.agents/skills/startechnica-agents
```

Add the absolute path to the clone's root directory (which contains [package.json](package.json)) to the `plugins` array in your OpenCode config (`opencode.json` or `opencode.jsonc`):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "startechnica-agents@git+https://github.com/firmansyahn/startechnica-agents.git",
  ]
}
```

Keep any existing plugin entries in that array. The plugin registers commands such as `/skill-go-testing` and the `startechnica_skill` tool, which accepts `list`, `search` and `load` actions. Native skill discovery is a separate interface; use the skills installation above if needed.

Keep the repository layout intact: the [plugin entrypoint](.opencode/plugins/index.js) reads the root [skills directory](skills/). Helpers and tests live outside the auto-discovered plugin directory.

See the [OpenCode plugin guide](docs/opencode.md) for Windows configuration, usage examples, updates and troubleshooting. The plugin requires OpenCode's v2 plugin API.

</details>

<details>
<summary>Antigravity</summary>

```sh
git clone https://github.com/firmansyahn/startechnica-agents.git ~/.antigravity/skills/startechnica-agents
```

Update with `git -C ~/.antigravity/skills/startechnica-agents pull`.

</details>

<details>
<summary>Codex</summary>

Install the plugin:

```sh
codex plugin add github:firmansyahn/startechnica-agents
```

Update with `codex plugin update startechnica-agents`. If the marketplace path is unavailable, clone into the shared skills directory:

```sh
git clone https://github.com/firmansyahn/startechnica-agents.git ~/.agents/skills/startechnica-agents
```

Update the clone with `git -C ~/.agents/skills/startechnica-agents pull`. Codex also discovers project-local skills in `.agents/skills/`.

</details>

<details>
<summary>By hand, or pinned in a project</summary>

Copy the folders under `skills/` into your tool's skills folder (`~/.claude/skills/`, a project's `.claude/skills/` or `.agents/skills/`, ...).

A project that keeps its copy in the repository (so every contributor and CI sees the same skills) syncs it from a release tag and never edits it: a local difference goes into a skill here and comes back with the next release. The project brings its own sync script, one that clones the tag, replaces `.agents/skills/` and records the release (`agent-skills-release`, step 4). For example:

```sh
node tools/sync-agent-skills.mjs v1.1.1      # a release tag
node tools/sync-agent-skills.mjs --check     # fails when the copy differs from its release
```

</details>

## Updating

Releases are tagged `v<major>.<minor>.<patch>`: a minor release adds skills or rules, a patch fixes or rewords, a major one removes or renames skills. Read the [release notes](https://github.com/firmansyahn/startechnica-agents/releases) before a major update.

See the [changelog](CHANGELOG.md) for version-specific changes and migration instructions.

## Where to start

Each area has a small router skill that sends a task to the right skill and lists what all of them assume. Start there when unsure which skill applies.

| Area | Router | Topic skills |
|---|---|---|
| Go services | `go-how-to` | `go-project-layout`, `go-code-style`, `go-error-handling`, `go-concurrency`, `go-database`, `go-mongodb`, `go-redis`, `go-kafka`, `go-clickhouse`, `go-testing`, `go-continuous-integration`, `go-security`, `go-http-handlers`, `go-knadh-koanf`, `go-observability`, `go-performance`, `go-safety`, `go-data-structures`, `go-refactoring`, `go-gopls`, `go-troubleshooting`, `go-nextjs-api-contract` |
| Next.js apps | `nextjs-how-to` | `nextjs-new-app`, `nextjs-app-structure`, `nextjs-data`, `nextjs-bff`, `nextjs-forms`, `nextjs-ui`, `nextjs-logging`, `nextjs-security`, `nextjs-e2e`, `nextjs-deploy`, `nextjs-package-manager`, `nextjs-upgrade` |
| OAuth / OIDC | (from `go-how-to`, `nextjs-how-to`) | `oauth-server`, `oauth-client` |
| git | `git-how-to` | `git-worktree`, `git-commit`, `git-gitignore` |
| GitLab | `gitlab-how-to` | `gitlab-mr`, `gitlab-ci` |
| Writing these skills | `agent-skills-authoring` | the rule format, rule prefixes, vendoring upstream skills, the skills lint |
| Releasing the skills | `agent-skills-release` | the bump kind, the version script, tagging and the GitHub release |

## Adapted upstream skills

The following skills preserve upstream guidance under a team-owned entrypoint. Their `metadata.version` tracks the local team-maintained skill; each `UPSTREAM.md` records its source, pinned commit, license and adaptation:

| Skills | Source | Licence |
|---|---|---|
| `nextjs-dev-loop` (upstream `next-dev-loop`), `next-bundle-optimizer` | [vercel/next.js](https://github.com/vercel/next.js/tree/canary/skills) | MIT |
| `git-using-worktrees`, `finishing-a-development-branch` | [obra/superpowers](https://github.com/obra/superpowers) | MIT |
| `git-resolve-conflicts` | [tailcallhq/forgecode](https://github.com/tailcallhq/forgecode) | Apache-2.0 |
| `gitlab-ci-skill` | [gitlab-org/ci-cd/gitlab-ci-skill](https://gitlab.com/gitlab-org/ci-cd/gitlab-ci-skill) | MIT |

## Vendored upstream skills

Included unchanged, each under its own licence (see its `LICENSE` and `UPSTREAM.md`):

| Skills | Source | Licence |
|---|---|---|
| `gitlab-glab`, `gitlab-mr-description`, `git-mr-adversarial-review`, `gitlab-pipeline-watch`, `gitlab-babysit-mr`, `gitlab-stacked-mrs` | [gitlab-org/ai/skills](https://gitlab.com/gitlab-org/ai/skills) | MIT |
| `mongodb-schema-design`, `mongodb-query-optimizer` (named by `go-mongodb`) | [mongodb/agent-skills](https://github.com/mongodb/agent-skills) | Apache-2.0 |
| `redis-security`, `redis-observability` (named by `go-redis`) | [redis/agent-skills](https://github.com/redis/agent-skills) | MIT |
| `clickhouse-best-practices` (named by `go-clickhouse`) | [ClickHouse/agent-skills](https://github.com/ClickHouse/agent-skills) | Apache-2.0 |

All of samber's Go skills the team uses ([samber/cc-skills-golang](https://github.com/samber/cc-skills-golang), MIT) are adapted rather than vendored: each `go-<topic>` skill holds the team's rules and decisions first, and the upstream material, edited to agree, under "In depth" or as one of its references, with both copyrights in its `LICENSE`. `go-how-to` maps every upstream `golang-*` name to the team skill that holds it.

## Reviewing with the skills

Every skill with rules has a "Reviewing" section. Skills whose rules a script can catch also have `scripts/scan.sh`, which prints candidates as `<rule-id>\t<where>: <text>` (POSIX tools only; Linux, macOS, Git Bash on Windows), for example:

```sh
bash skills/go-security/scripts/scan.sh path/to/module
bash skills/git-commit/scripts/scan.sh origin/main
```

Every line is a candidate: open the rule file and confirm it before reporting.

Each rule's `check` says what catches a violation: `scan`, `lint`, `eslint`, `test`, `hook`, `ci` or `review`. The checks that fail a build instead of waiting for a review ship as files to copy into a project: the Next.js lint config and rule tests (`nextjs-new-app` references/enforcement-kit.md), Go test templates and CI scripts in the Go skills' `assets/`, and git and agent hooks in `git-commit`, `git-worktree` and `gitlab-mr` `assets/hooks/`.

## Checking the skills

```sh
node skills/agent-skills-authoring/scripts/lint-skills.mjs
```

It checks frontmatter, licences, upstream records, that each team skill opens with a one-sentence principle and has no role (persona) lines, links and anchors, rule files and IDs, that every skill is routed, that no skill hard-codes an install path, and LF line endings. CI runs it on every push and pull request. Before publishing a fork elsewhere, set `SKILLS_INTERNAL_PATTERNS` to a regex of your organisation's own names to catch any that slipped into an example.

## Licence

[MIT](LICENSE) for the team skills. Vendored skills keep their own licences, named above and in each skill's folder.
