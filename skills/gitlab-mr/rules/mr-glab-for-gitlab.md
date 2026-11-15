---
title: Reach GitLab through glab, never a pasted token
impact: MEDIUM
tags: glab, credentials
check: scan, hook, review
---

## Reach GitLab through glab, never a pasted token

**Impact: MEDIUM** (tokens end up in shell history, logs and transcripts; private projects and templates look missing)

Every GitLab read and write (repos, files in other projects, MRs, pipelines, job logs) goes through `glab` and the credentials `glab auth login` stored. Don't `curl` the API with a token in the command, don't clone over HTTPS with a token in the URL, and don't ask the user to paste one. `glab api` covers any endpoint the subcommands don't.

**Incorrect:**

```sh
curl -H "PRIVATE-TOKEN: glpat-..." https://<gitlab-host>/api/v4/projects/123/jobs/456/trace
git clone https://oauth2:glpat-...@<gitlab-host>/<group>/<project>.git
```

**Correct:**

```sh
glab api projects/:id/jobs/456/trace
glab repo clone <group>/<project>
```

**How to check:** `scripts/scan.sh` lists `PRIVATE-TOKEN` headers, `glpat-` tokens and `oauth2:` credentials in URLs in tracked files. The `guard-glab-token.mjs` hook (`assets/hooks/`) covers commands: it refuses a Bash command carrying a `PRIVATE-TOKEN` header, a `glpat-` token or credentials in a URL (anywhere in the command, a commit message included), or running `curl`/`wget` against `/api/v4/`. Neither sees a token pasted into chat or typed in a terminal outside the agent, or another tool reaching the API: review those.
