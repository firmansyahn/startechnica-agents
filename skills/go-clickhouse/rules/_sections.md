# Sections

Rule files are named `<prefix>-<slug>.md`; the file name without `.md` is the rule ID cited in reviews. IDs are unique across all team skills (prefix registry: [agent-skills-authoring](../../agent-skills-authoring/SKILL.md) references/rule-prefixes.md). Schema and query design rules are the vendored [clickhouse-best-practices](../../clickhouse-best-practices/SKILL.md) (`schema-*`, `query-*`, `insert-*`), which keeps its own names.

| Section | Prefix | Impact | Covers |
|---|---|---|---|
| Connection and queries | `ch-` | CRITICAL to MEDIUM | The one connection pool, bound parameters, contexts and deadlines, closing rows |
| Inserts | `ch-` | HIGH | Batching, closing batches, async inserts, retries and deduplication, mutations |

What each impact level means for the merge is in [agent-skills-authoring](../../agent-skills-authoring/SKILL.md) ("Impact"). Impact is the default severity of a finding; raise it one level when the code is on an authentication, payment or data-deletion path.
