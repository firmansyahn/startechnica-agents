# Upstream

Part of this skill is absorbed from samber/cc-skills-golang: https://github.com/samber/cc-skills-golang/tree/d68d80aec298e1b74b37c2a472c002b5217248b3/skills/golang-continuous-integration

- Commit: `d68d80aec298e1b74b37c2a472c002b5217248b3` (2026-11-08)
- License: MIT, Copyright (c) 2026 Samuel Berthe (kept in `LICENSE`)
- What came in: Go CI testing, lint, module consistency, vulnerability scanning, dependency-update, release, container-build, and repository-security guidance, adapted into the "In depth" section of `SKILL.md`.
- Local changes: GitHub Actions guidance was rewritten around GitLab CI; Go version selection follows `go.mod`; Go service releases use the team's GitLab image/chart templates. The GitHub Actions assets and GitHub-specific repository-security reference were not copied because the team uses GitLab and already has GitLab CI/MR guidance. The upstream evals were replaced with GitLab/Go-team scenarios.

To update: diff upstream's `skills/golang-continuous-integration` between the commit above and a newer one, port relevant changes into `SKILL.md` and `evals/evals.json` by hand, keeping the team's GitLab decisions, and update the commit above.
