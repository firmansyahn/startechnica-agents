# Upstream

Part of this skill is absorbed from samber/cc-skills-golang: https://github.com/samber/cc-skills-golang/tree/d68d80aec298e1b74b37c2a472c002b5217248b3/skills/golang-observability

- Commit: `d68d80aec298e1b74b37c2a472c002b5217248b3` (2026-11-08)
- License: MIT, Copyright (c) 2026 Samuel Berthe (kept in `LICENSE`)
- What came in: the upstream `SKILL.md` body, now the "In depth" section of `SKILL.md` (headings one level down, the "Community default" note dropped), and its `references/` and `evals/` folders.
- Local changes: the team's rules and decisions come first in `SKILL.md`; upstream passages that contradict a team decision are rewritten or removed (see "Team decisions"); links to the absorbed upstream skills name the team skills, and links to skills that aren't vendored (`samber/cc-skills@promql-cli`) are dropped; upstream's `log/slog` material is rewritten for zap (the team's logger): `references/logging.md` in full, the logging passages and examples in `SKILL.md`, `references/profiling.md` and `references/rum.md`, and the logging evals (4, 5, 10, 22-24, 33, 35, 36, 40), with the "migrate zap to slog" guidance removed.

To update: diff upstream's `skills/golang-observability` between the commit above and a newer one, port each change into `SKILL.md` ("In depth"), `references/` and `evals/` by hand, keeping the team's decisions, and update the commit above.
