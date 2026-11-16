# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID cited in reviews. IDs are unique across all team skills (prefix registry: [agent-skills-authoring](../../agent-skills-authoring/SKILL.md) references/rule-prefixes.md).

| Section | Prefix | Impact | Covers |
|---|---|---|---|
| Errors | `err-` | HIGH | Handling, wrapping and matching errors; panics; exits |

What each impact level means for the merge is in [agent-skills-authoring](../../agent-skills-authoring/SKILL.md) ("Impact"). Impact is the default severity of a finding; raise it one level when the code is on an authentication, payment or data-deletion path.
