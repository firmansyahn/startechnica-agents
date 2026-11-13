# Working on this repository

The skills are in `skills/`, one folder each. Before adding or changing a skill or rule, read `skills/agent-skills-authoring/SKILL.md`: the skill layout and frontmatter, the rule format and prefixes, neutral examples, portable paths, and how to vendor, absorb or update an upstream skill.

- Never edit a vendored skill's content (a folder whose `UPSTREAM.md` says it is vendored); put the difference in the team skill that names it.
- Run `node skills/agent-skills-authoring/scripts/lint-skills.mjs` before committing; it must report 0 errors.
- Keep the version in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.codex-plugin/plugin.json`, `.cursor-plugin/plugin.json` and `gemini-extension.json` in step.
- Conventional Commits, LF line endings.
