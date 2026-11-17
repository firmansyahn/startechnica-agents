# Upstream

Vendored from Redis's official agent skills: https://github.com/redis/agent-skills/tree/74708dab4b3f81a9845803c3f642a4f7d443af69/skills/redis-security

- Commit: `74708dab4b3f81a9845803c3f642a4f7d443af69` (2026-11-05)
- License: MIT, Copyright (c) 2026 Redis, Inc. (the repository's `LICENSE`, copied here)
- Local changes: none. The folder is upstream's `skills/redis-security` unchanged, plus `LICENSE` and this file. Its client examples are Python; the team's Go side (the client's ACL user, `password_file`, TLS settings) is in the team skill `go-redis`, which wins where the two differ.

To update: replace this folder with upstream's `skills/redis-security` at a newer commit, keep `LICENSE` (re-copy it if upstream's changed) and this file, update the commit above, and re-read `go-redis` sections 1 and 7.
