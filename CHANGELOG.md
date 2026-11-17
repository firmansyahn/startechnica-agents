# Changelog

## v1.4.0

- Add Go skills for four more stores, routed from [go-how-to](skills/go-how-to/SKILL.md): [go-mongodb](skills/go-mongodb/SKILL.md) (mongo-driver v2, `mongo-` rules), [go-redis](skills/go-redis/SKILL.md) (go-redis v9, `redis-` rules), [go-kafka](skills/go-kafka/SKILL.md) (franz-go, `kafka-` rules) and [go-clickhouse](skills/go-clickhouse/SKILL.md) (clickhouse-go v2, `ch-` rules), each with a `scripts/scan.sh` and evals.
- Vendor the vendors' official server-side skills unchanged: `mongodb-schema-design` and `mongodb-query-optimizer` (Apache-2.0), `redis-security` and `redis-observability` (MIT), `clickhouse-best-practices` (Apache-2.0).

## v1.3.0

- Fix OpenCode Git installation with a root npm package, a locked OpenCode v2.3.0 SDK dependency, and an entrypoint under [.opencode/plugins/](.opencode/plugins/). Update local installation paths, package tests and CI.
- Add version metadata to the six formerly versionless upstream skills and maintain them as adapted team skills, preserving licenses and provenance.
- Rename `next-dev-loop` to [nextjs-dev-loop](skills/nextjs-dev-loop/SKILL.md). Remove the old skill directory from downstream copies to avoid loading both names.
- Align adapted Git and GitLab CI guidance with team conventions, including Podman on RHEL-family systems.
- Remove personal email addresses from package metadata and copyright notices.
- Move version-specific migration guidance from the README into this changelog.

## v1.2.0

Adds an optional OpenCode v2 plugin with skill commands and a lookup tool. Follow the [OpenCode plugin guide](docs/opencode.md) to configure it; updating native skills alone does not enable the plugin.

## v1.1.0

Moved the Next.js checks into a kit you copy into an app ([nextjs-new-app](skills/nextjs-new-app/SKILL.md), [enforcement kit](skills/nextjs-new-app/references/enforcement-kit.md)). Updating the skills doesn't change an app's copied files: re-copy the lint config and rule tests, and add the dev dependencies the kit names.

## v1.0.0

Replaced the `golang-*` skills with `go-<topic>` skills (the mapping is in the first rule of [go-how-to](skills/go-how-to/SKILL.md)). After updating, remove any `golang-*` skill that came from this repository (`npx skills list`, then `npx skills remove <name>`), or both versions load. Skills installed from samber's own repository are separate: leave them.
