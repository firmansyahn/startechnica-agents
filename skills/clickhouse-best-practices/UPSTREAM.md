# Upstream

Vendored unchanged from ClickHouse's official agent skills: https://github.com/ClickHouse/agent-skills/tree/d3b2b5ba43a8b80c2d08858b68d53edc701b5ace/skills/clickhouse-best-practices

- Commit: `d3b2b5ba43a8b80c2d08858b68d53edc701b5ace` (2026-11-02)
- License: Apache License 2.0, ClickHouse Inc (the repository's `LICENSE`, copied here as `LICENSE`, with its `NOTICE` beside it)
- Local changes: none to the skill's files. `LICENSE` and `NOTICE` come from the repository root, since upstream keeps them there and not in the skill folder; this file is added.

Team conventions for a Go service that talks to ClickHouse (the client, batching in the service, contexts, parameters, retries, tests) live in the team skill `go-clickhouse`, which cites this skill's rules for schema, query and insert design and says where the team differs. Nothing here is edited for the team.

To update: replace this folder with upstream's `skills/clickhouse-best-practices` at a newer commit, copy the repository's `LICENSE` and `NOTICE` back in, keep this file, update the commit above, and re-read `go-clickhouse` for rule names it cites that were renamed or removed.
