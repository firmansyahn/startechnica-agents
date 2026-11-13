# Upstream

Vendored from tailcallhq/forgecode (upstream name `resolve-conflicts`): https://github.com/tailcallhq/forgecode/tree/ee249082ac90a78b927e93333dfe5be6aba7d47d/.forge/skills/resolve-conflicts

- Commit: `ee249082ac90a78b927e93333dfe5be6aba7d47d` (2025-11-27)
- License: Apache License 2.0 (see `LICENSE`)
- Local changes (Apache-2.0 section 4b): the script paths `.forge/skills/resolve-conflicts/scripts/` in `SKILL.md` and `scripts/handle-deleted-modified.sh` were changed to paths relative to the skill's own folder (`<this skill>/scripts/...` in `SKILL.md`, `$(dirname "$0")/...` in the script), so they work wherever the skill is installed; and the folder and the frontmatter `name` are `git-resolve-conflicts` instead of `resolve-conflicts`. Nothing else. Team conventions live in the overlay skills (`git-worktree`, `gitlab-mr`).

To update: replace this folder with upstream's `.forge/skills/resolve-conflicts` at a newer commit, redo the local changes above, keep `LICENSE` and this file, and update the commit above.
