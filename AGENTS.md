# Working on this repository

This repo is a library of agent skills: `skills/` holds one folder per skill, plus `scripts/` (version tooling), five plugin manifests (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `gemini-extension.json`) and the OpenCode plugin package (`opencode-plugin/package.json`). See the `README.md` for the skill inventory, install methods and the vendored-sources table.

Kinds of skills:

- **Team skills** (`go-*`, `nextjs-*`, `git-*`, `gitlab-*`, `oauth-*`, `agent-skills-authoring`): written here. Each has `SKILL.md`, `LICENSE`, `rules/` (one file per rule), and where useful `references/`, `assets/`, `scripts/scan.sh`.
- **Router skills** (`go-how-to`, `nextjs-how-to`, `git-how-to`, `gitlab-how-to`): only route to sibling skills, linking them with relative paths like `../go-testing/SKILL.md`.
- **Vendored skills** (any folder whose `UPSTREAM.md` says it is vendored): upstream content, unchanged.

Before adding or changing a skill or rule, read `skills/agent-skills-authoring/SKILL.md`: the skill layout and frontmatter, the rule format and prefixes, neutral examples, portable paths, and how to vendor, absorb or update an upstream skill.

## Rules of the road

- Never edit a vendored skill's content; put the difference in the team skill that names it.
- A rule's file name is its ID (`rules/<prefix>-<slug>.md`), unique across all skills; the prefix must be registered in `skills/agent-skills-authoring/references/rule-prefixes.md` and the skill's `rules/_sections.md`. IDs are permanent once cited elsewhere.
- A new skill must be routed by its area's `<area>-how-to` skill and named by another team skill, or the lint fails.
- Skill content stays neutral and portable: relative links only, no install-location paths, generic domains and placeholders in examples, commands that work on Linux/macOS/Windows Git Bash.
- Versions: bump a skill's `metadata.version` in its frontmatter (minor for a new skill or rule, patch for fixes). Plugin versions are bumped only via `node scripts/bump-version.mjs <major.minor.patch>` — it updates all plugin manifests and packages; editing one by hand fails CI's `--check`.

## Commands

- Lint (must report 0 errors before committing): `node skills/agent-skills-authoring/scripts/lint-skills.mjs`
- Manifest version drift check: `node scripts/bump-version.mjs --check`
- A skill's mechanical rule scan (each hit is a candidate to confirm against the rule file): `bash skills/<skill>/scripts/scan.sh <path-or-ref>`

CI (`.github/workflows/lint.yml`) runs the lint, `bash -n` on every `scripts/*.sh`, the version `--check`, and JSON-parses all plugin manifests and packages. Conventional Commits, LF line endings (`.gitattributes` enforces `eol=lf`); changes land through a pull request with the lint green.

## Releasing

This repository is the original of the skills: projects keep a copy synced from a release and never edit it.

1. In the pull request, set the new version in every plugin manifest and package: `node scripts/bump-version.mjs <major.minor.patch>` (minor for a new skill or rule, patch for fixes and wording).
2. Merge once the lint passes.
3. Tag the merge commit and publish the release: `gh release create v<version> --target main --title v<version> --notes "<what changed>"`.
4. In each project that keeps a copy, sync it to the new tag (for example `node tools/sync-agent-skills.mjs v<version>`) and commit it there.
