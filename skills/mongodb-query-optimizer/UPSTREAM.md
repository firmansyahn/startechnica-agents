# Upstream

Vendored from MongoDB's official agent skills: https://github.com/mongodb/agent-skills/tree/d649b461ece46f485f86f069d4220e61e6df68f6/skills/mongodb-query-optimizer

- Commit: `d649b461ece46f485f86f069d4220e61e6df68f6` (2026-11-16)
- License: Apache-2.0, MongoDB, Inc. (the repository's `LICENSE`, copied here as `LICENSE`)
- Local changes: none. The repository's licence file is copied into this folder, since upstream keeps one licence at the repository root. Team conventions that differ (indexes are created by the service's index declarations or a reviewed migration, never by an agent through MCP; the Go driver) live in the team skill `go-mongodb`, not here.

To update: replace this folder with upstream's `skills/mongodb-query-optimizer` at a newer commit, copy the repository's `LICENSE` in again, keep this file, update the commit above, and re-read `go-mongodb` ("Team decisions") for anything that now differs.
