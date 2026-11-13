---
title: Reach GitLab through glab, never a pasted token
impact: MEDIUM
tags: glab, credentials
check: review
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

**How to check:** no `PRIVATE-TOKEN`, `glpat-` or `oauth2:` in commands, scripts or docs.
