# Upstream

Vendored from Redis's official agent skills: https://github.com/redis/agent-skills/tree/74708dab4b3f81a9845803c3f642a4f7d443af69/skills/redis-observability

- Commit: `74708dab4b3f81a9845803c3f642a4f7d443af69` (2026-11-05)
- License: MIT, Copyright (c) 2026 Redis, Inc. (the repository's `LICENSE`, copied here)
- Local changes: none. The folder is upstream's `skills/redis-observability` unchanged, plus `LICENSE` and this file. Its client examples are Python; the team's Go side (redisotel tracing and metrics, zap logging, pool statistics) is in the team skill `go-redis` and in `go-observability`, which win where they differ.

To update: replace this folder with upstream's `skills/redis-observability` at a newer commit, keep `LICENSE` (re-copy it if upstream's changed) and this file, update the commit above, and re-read `go-redis` section 7.
