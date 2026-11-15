# Upstream

Part of this skill is absorbed from samber/cc-skills-golang:

- `golang-performance`: https://github.com/samber/cc-skills-golang/tree/d68d80aec298e1b74b37c2a472c002b5217248b3/skills/golang-performance, commit `d68d80aec298e1b74b37c2a472c002b5217248b3` (2026-11-08). What came in: the upstream `SKILL.md` body, now the "In depth" section of `SKILL.md` (headings two levels down, the "Community default" note dropped), and its `references/`, `evals/` and `assets/` folders.
- `golang-benchmark`: https://github.com/samber/cc-skills-golang/tree/d68d80aec298e1b74b37c2a472c002b5217248b3/skills/golang-benchmark, commit `d68d80aec298e1b74b37c2a472c002b5217248b3` (2026-11-08). What came in: the upstream `SKILL.md` body, now [references/benchmark.md](references/benchmark.md), its `references/` in `references/benchmark/`, `assets/` in `assets/benchmark/` and `evals/evals.json` as `evals/benchmark.json`.

- License: MIT, Copyright (c) 2026 Samuel Berthe (kept in `LICENSE`)
- Local changes: the team's principle and decisions come first in `SKILL.md`; upstream passages that contradict a team decision are rewritten or removed (see "Team decisions"); links to absorbed upstream skills name the team skills; the "Thinking mode" and "Orchestration mode" lines say how to ask for them on Claude Code, oh-my-pi, OpenCode and Codex; the hot-path logging advice (`slog.LogAttrs`, in `SKILL.md` and `references/runtime.md`) and its eval rewritten for zap's typed fields and `log.Check`; the gobenchdata GitHub Action setup in `references/benchmark/ci-regression.md` rewritten as GitLab CI jobs with GitLab Pages, and the GitHub Actions benchmark evals rewritten for GitLab CI; the `samber/go-singleflightx` suggestion in `references/caching.md` removed.

To update: diff upstream's skill folders between the commit above and a newer one, port each change into `SKILL.md` ("In depth") and the moved files by hand, keeping the team's decisions, and update the commit above.
