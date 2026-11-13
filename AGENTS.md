# Working on this repository

The skills are in `skills/`, one folder each. Before adding or changing a skill or rule, read `skills/agent-skills-authoring/SKILL.md`: the skill layout and frontmatter, the rule format and prefixes, neutral examples, portable paths, and how to vendor, absorb or update an upstream skill.

- Never edit a vendored skill's content (a folder whose `UPSTREAM.md` says it is vendored); put the difference in the team skill that names it.
- Run `node skills/agent-skills-authoring/scripts/lint-skills.mjs` before committing; it must report 0 errors.
- Conventional Commits, LF line endings; changes land through a pull request with the lint green.

## Releasing

This repository is the original of the skills: projects keep a copy synced from a release and never edit it.

1. In the pull request, set the new version in every plugin manifest: `node scripts/bump-version.mjs <major.minor.patch>` (minor for a new skill or rule, patch for fixes and wording).
2. Merge once the lint passes.
3. Tag the merge commit and publish the release: `gh release create v<version> --target main --title v<version> --notes "<what changed>"`.
4. In each project that keeps a copy, sync it to the new tag (for example `node tools/sync-agent-skills.mjs v<version>`) and commit it there.
