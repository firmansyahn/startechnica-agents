# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID cited in reviews. IDs are unique across all team skills (prefix registry: [agent-skills-authoring](../../agent-skills-authoring/SKILL.md) references/rule-prefixes.md).

| Section | Prefix | Impact | Covers |
|---|---|---|---|
| Kafka | `kafka-` | CRITICAL | Produce and fetch errors, offset commits, the outbox, acks and topics, keys, idempotent handlers, dead letters, consumer concurrency, shutdown |

What each impact level means for the merge is in [agent-skills-authoring](../../agent-skills-authoring/SKILL.md) ("Impact"). Impact is the default severity of a finding; raise it one level when the records carry payments, authentication or data deletion.
