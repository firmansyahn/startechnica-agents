# Upstream

Vendored from GitLab's official agent skills (upstream name `glab`): https://gitlab.com/gitlab-org/ai/skills/-/tree/0ea59cf16c7babaa1892a12c50ac3894b730f630/skills/glab

- Commit: `0ea59cf16c7babaa1892a12c50ac3894b730f630` (2026-11-12)
- License: MIT, Copyright (c) 2026 GitLab B.V. (see `LICENSE`)
- Local changes: the folder and the frontmatter `name` are `gitlab-glab` instead of `glab`, so the skill sorts with the other GitLab skills and reads as a skill, not the CLI. Nothing else. Team conventions that differ live in the team overlay skills (`gitlab-mr`, `gitlab-ci`), not here.

To update: replace this folder with upstream's `skills/glab` at a newer commit, set the frontmatter `name` back to `gitlab-glab`, keep `LICENSE` and this file, and update the commit above.
