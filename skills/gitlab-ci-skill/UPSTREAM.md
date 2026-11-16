# Upstream

Part of this skill is absorbed from GitLab's official GitLab CI Skill: https://gitlab.com/gitlab-org/ci-cd/gitlab-ci-skill/-/tree/6ddc101995c2504c5743612920e0f0748d854dc3

- Commit: `6ddc101995c2504c5743612920e0f0748d854dc3` (2026-05-25)
- License: MIT, GitLab Inc. (see `LICENSE`)
- Local changes: the upstream repository's `.gitignore` and `.gitlab-ci.yml` were left out; upstream skill guidance, references and examples are retained. The entrypoint adds version metadata and team decisions, with `gitlab-ci` as the winning overlay for project templates, workflow rules and required gates. RHEL-family local verification uses Podman's Docker-compatible interfaces rather than Docker Engine. Initial-commit instructions follow `git-commit` rather than staging the whole tree. The README's fixed installation-path table was replaced with a link to this repository's multi-client installation guide.

To update: diff the upstream skill against the pinned commit, port relevant skill, reference and example changes, preserve team decisions, and update the commit above. Do not copy the upstream repository's CI files.
