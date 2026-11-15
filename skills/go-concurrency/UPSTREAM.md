# Upstream

Part of this skill is absorbed from samber/cc-skills-golang: https://github.com/samber/cc-skills-golang/tree/d68d80aec298e1b74b37c2a472c002b5217248b3/skills/golang-concurrency

- Commit: `d68d80aec298e1b74b37c2a472c002b5217248b3` (2026-11-08)
- License: MIT, Copyright (c) 2026 Samuel Berthe (kept in `LICENSE`)
- What came in: the upstream `SKILL.md` body, now the "In depth" section of `SKILL.md` (headings one level down, the "Community default" note dropped), and its `references/` and `evals/` folders.
- Local changes: the team's rules, decisions and rule files come first in `SKILL.md`; upstream passages that contradict a team decision are rewritten or removed (see "Team decisions"); links to the absorbed upstream skills name the team skills. In `references/context/`: the logger is no longer a context value but injected, with request fields added by `WithTrace(ctx, log)`.

Also absorbed (each upstream skill whole, as one reference of this skill; links to absorbed upstream skills name the team skills, and the "Orchestration mode" lines say how to ask for it on each harness):

- `golang-context`: https://github.com/samber/cc-skills-golang/tree/d68d80aec298e1b74b37c2a472c002b5217248b3/skills/golang-context, commit `d68d80aec298e1b74b37c2a472c002b5217248b3` (2026-11-08). Its `SKILL.md` body is now [references/context.md](references/context.md); its `references/`, `assets/` and `evals/evals.json` are in `references/context/`, `assets/context/` and `evals/context.json`.

To update: diff upstream's `skills/golang-concurrency` between the commit above and a newer one, port each change into `SKILL.md` ("In depth"), `references/` and `evals/` by hand, keeping the team's decisions, and update the commit above.
