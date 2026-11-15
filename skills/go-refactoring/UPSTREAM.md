# Upstream

Part of this skill is absorbed from samber/cc-skills-golang:

- `golang-refactoring`: https://github.com/samber/cc-skills-golang/tree/d68d80aec298e1b74b37c2a472c002b5217248b3/skills/golang-refactoring, commit `d68d80aec298e1b74b37c2a472c002b5217248b3` (2026-11-08). What came in: the upstream `SKILL.md` body, now the "In depth" section of `SKILL.md` (headings two levels down, the "Community default" note dropped), and its `references/`, `evals/` and `assets/` folders.

- License: MIT, Copyright (c) 2026 Samuel Berthe (kept in `LICENSE`)
- Local changes: the team's principle and decisions come first in `SKILL.md`; upstream passages that contradict a team decision are rewritten or removed (see "Team decisions"); links to absorbed upstream skills name the team skills; the "Thinking mode" and "Orchestration mode" lines say how to ask for them on Claude Code, oh-my-pi, OpenCode and Codex; `gh pr create` in `references/workflow.md` became `glab mr create --target-branch`; the links to the `golang-gopls` skill (in `SKILL.md`, `references/workflow.md` and `references/go-tooling.md`) are dropped or point at the gopls documentation.

To update: diff upstream's skill folders between the commit above and a newer one, port each change into `SKILL.md` ("In depth") and the moved files by hand, keeping the team's decisions, and update the commit above.
