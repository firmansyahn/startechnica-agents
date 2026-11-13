---
name: agent-skills-authoring
description: "Use when writing, changing, renaming, vendoring or checking the team's agent skills: a new team skill or rule, a rule ID and its prefix, the rule file format and impact levels, the finding format reviews use, adopting an established upstream skill (vendored unchanged, or absorbed into a team skill), updating one to a newer commit, keeping examples neutral and paths portable, and running the skills lint (frontmatter, licences, links, rules, orphans, line endings, install paths, the organisation's private names) before committing or publishing the skills."
user-invocable: true
license: MIT
compatibility: Designed for Claude Code, Codex, OpenCode or similar harness, and for any folder of Agent Skills.
metadata:
  author: firmansyahn
  version: "0.1.0"
---

# Writing and checking the team's skills

The skills are installed together, each in its own folder, wherever a project or user keeps skills. They follow the [Agent Skills](https://agentskills.io) format and the samber/cc-skills-golang shape: **one focused skill per topic**, each owning its rules, its references and its own scan; a small `<area>-how-to` skill per area (`git-how-to`, `gitlab-how-to`, `go-how-to`, `nextjs-how-to`) only routes to them.

Details: [references/rule-prefixes.md](references/rule-prefixes.md) (every rule prefix and the skill that owns it).

## 1. A team skill

```
<skill>/
  SKILL.md        frontmatter + the patterns, decisions, a Rules index, a checklist
  LICENSE         MIT, the team's copyright (plus upstream's when absorbed)
  rules/          _sections.md, _template.md, one <id>.md per rule
  references/     detail SKILL.md links to, read only when needed
  assets/         files copied into a project (templates, tests, hooks)
  scripts/        scan.sh for the rules a script can catch; other tools
  UPSTREAM.md     only when upstream material was absorbed
```

- **Frontmatter:** `name` equals the folder (lower case, hyphens, at most 64 characters); `description` says when to use it, in at most 1024 characters, naming the tasks and words that should trigger it; `user-invocable: true`, `license: MIT`, `compatibility`, `metadata.author`, `metadata.version` (bump the minor on a new rule or section).
- **Name by area:** `git-`, `gitlab-`, `go-`, `nextjs-`, `oauth-`, and `<area>-<library>` for a library skill (`go-knadh-koanf`).
- **Every skill is reachable:** its area's `<area>-how-to` routes to it, and a related skill names it.
- **Portable:** files are linked relative to the skill (`references/x.md`, `bash <this skill>/scripts/scan.sh`, `$(dirname "$0")` in scripts), and other skills are named in backticks (`git-commit`) or linked as a sibling (`../git-commit/SKILL.md`). Never a path into an install location (a dot-folder's `skills/<name>`).
- **Neutral examples:** a generic domain (customers, orders, users, items), `example.com` hosts, documentation IP ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24), and placeholders for whatever a project names (`<app>`, `<app-root>`, `<module-root>`, `<topic>`). Never names, paths, packages, variables or numbers from the project a rule was learnt in: the skills are published beyond it.
- **Every platform:** commands work on Linux, macOS and Windows (Git Bash); where they differ, give each.
- LF line endings in every file.

## 2. Rules

- **One rule per file** in the skill that teaches the pattern: copy its `rules/_template.md` to `rules/<prefix>-<slug>.md`. The file name is the rule ID; IDs are unique across all skills, and each prefix belongs to one skill ([references/rule-prefixes.md](references/rule-prefixes.md); a new prefix gets a row there and in the skill's `rules/_sections.md`).
- **Frontmatter:** `title` (imperative), `impact`, `tags`, `check` (what catches a violation today: `scan`, `lint`, `eslint`, `test`, `hook`, `review`, with a note in brackets).
- **Body:** the title as a heading, `**Impact: X** (what goes wrong)`, two or three sentences, the smallest **Incorrect** and **Correct** pair, and **How to check**.
- **Indexed:** a row in the skill's Rules table (`| ID | Rule | Impact | Check |`), grouped by its sections.
- **Caught where possible:** `check: scan` gets a check in the skill's `scripts/scan.sh`; `test`/`eslint`/`hook` names the file, in the skill's `assets/` when it is generic.
- **IDs are permanent once cited:** rename only with a note in the old file pointing to the new ID.

### Impact

| Impact | Means | Merge? |
|---|---|---|
| CRITICAL | Exploitable, or loses or leaks data | Blocks the merge |
| HIGH | Breaks under load, failure or concurrency; wrong results on an error path | Fix before merge unless the author shows it can't happen |
| MEDIUM | Makes failures hard to diagnose or the code hard to change safely | Fix in this change or file a follow-up |
| LOW | Consistency and readability | Mention; don't block |

Impact is the default severity of a finding; raise it one level on an authentication, payment or data-deletion path, in a public repo (commit and MR rules) or on a production release (CI rules).

### Scan scripts and findings

A skill's `scripts/scan.sh` is read-only, POSIX tools only, prints one candidate per line as `<rule-id>\t<where>: <text>` and then a count per rule, and exits 1 on findings only with `--strict`. Every line is a candidate: open the rule and confirm it before reporting. A review reports each finding as:

```
[CRITICAL] sec-sql-parameterized  internal/billing/store.go:88
The ORDER BY column comes from the query string through fmt.Sprintf; map it through an allow-list of column names.
```

Ordered by impact, then file; one finding per site, repeats of one rule in one file grouped; say what to change, citing the rule's "Correct" shape. Then list what wasn't covered: rules checked only by a test, lint or hook the project doesn't have.

## 3. Upstream skills

Look for an established skill (Anthropic's `anthropics/skills`, GitLab's `gitlab-org/ai/skills`, obra/superpowers, the Next.js repository's `skills/`, samber/cc-skills-golang) before writing a new one.

- **Vendor** a skill on a topic the team has no skill for: the upstream folder unchanged, plus `LICENSE` (upstream's) and `UPSTREAM.md` (source URL, pinned commit and date, licence, and any local change such as a rename). The team skill closest to its topic names it and says where the team differs; the team wins.
- **Absorb** a skill on a topic the team has a skill for: its body goes under "## In depth" in the team skill (headings one level down), its `references/` and `evals/` move in, passages that contradict the team are edited, upstream's copyright is added to `LICENSE`, and `UPSTREAM.md` takes the absorbed form ("Part of this skill is absorbed from ...", what came in, local changes, how to update). Delete the vendored folder.
- **Update** a vendored skill: replace the folder with upstream's at a newer commit, redo the local changes `UPSTREAM.md` lists, update the commit, and re-read the team skill that names it. An absorbed skill: diff upstream between the two commits and port each change by hand.
- Never edit a vendored skill's content; put the difference in the team skill.

## 4. Checking the skills

Before committing a change to the skills, run [scripts/lint-skills.mjs](scripts/lint-skills.mjs):

```sh
node <this skill>/scripts/lint-skills.mjs [skills-dir]   # default: the folder that holds this skill
```

It checks every skill's frontmatter (name equals the folder, description within 1024 characters, licence and version on team skills), `LICENSE` and `UPSTREAM.md`, relative links and their anchors, rule files (frontmatter, unique IDs, indexed, prefix registered), that every skill is named by another team skill, that no team skill hard-codes where skills are installed, and LF line endings. It exits 1 on an error.

Before publishing the skills outside the organisation, set `SKILLS_INTERNAL_PATTERNS` to a regex of the organisation's own names (projects, hosts, domains, clusters, customers; kept in CI variables, never in the skills): any line matching it is an error, and private IPv4 addresses are warned about.

```sh
SKILLS_INTERNAL_PATTERNS='acme|corp\.example|cluster-a' node <this skill>/scripts/lint-skills.mjs
```

## Checklist

- [ ] `name` equals the folder; the description says when to use it, within 1024 characters
- [ ] The area's `<area>-how-to` routes to the skill
- [ ] Each rule in its own file, indexed with its check, prefix registered
- [ ] Scan checks for the rules marked `scan`
- [ ] Examples neutral; paths relative to the skill; LF endings
- [ ] Vendored skills unchanged, with `LICENSE` and `UPSTREAM.md`
- [ ] The lint passes (with `SKILLS_INTERNAL_PATTERNS` before publishing)
