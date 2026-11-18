# Upstream

Part of this skill is absorbed from samber/cc-skills-golang:

- `golang-gopls`: https://github.com/samber/cc-skills-golang/tree/d68d80aec298e1b74b37c2a472c002b5217248b3/skills/golang-gopls, commit `d68d80aec298e1b74b37c2a472c002b5217248b3` (2026-11-08). What came in: the upstream `SKILL.md` body, now the "In depth" section of `SKILL.md` (headings one level down, the per-harness frontmatter dropped), and its `references/` folder (`cli.md`, `features.md`, `matrix.md`, `mcp.md`, `settings.md`). Upstream has no `evals/` or `assets/` for this skill.

- License: MIT, Copyright (c) 2026 Samuel Berthe (kept in `LICENSE`)
- Local changes: the team's principle and decisions come first in `SKILL.md`; upstream passages that contradict a team decision are rewritten or removed (see "Team decisions"); the links to the upstream `golang-pkg-go-dev`, `golang-security` and `golang-how-to` skills are replaced by pkg.go.dev and the team skills `go-security` and `go-continuous-integration` (the "gopls vs godig vs Context7 vs govulncheck" section is now "gopls vs pkg.go.dev vs govulncheck"); the baseline vulnerability check is reported, not fixed; the last paragraph of `references/mcp.md` points to pkg.go.dev instead of the `godig` skill. `references/harnesses.md` is team-written (not upstream): the gopls setup for Claude Code, OpenCode and oh-my-pi.

To update: diff upstream's skill folder between the commit above and a newer one, port each change into `SKILL.md` ("In depth") and `references/` by hand, keeping the team's decisions, and update the commit above.
