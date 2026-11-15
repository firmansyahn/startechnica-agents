---
title: Keep internal details out of public MRs
impact: CRITICAL
tags: security, public, disclosure
check: scan (candidates), hook (candidates), review
---

## Keep internal details out of public MRs

**Impact: CRITICAL** (internal hosts, networks, customers or credentials published; deleting or force-pushing doesn't take them back)

Before a push, MR, comment or release, check the repo's visibility. If it is public, or you can't tell, nothing internal goes out: in files, commit messages, branch names, MR titles and descriptions, review comments, or author identity. Internal means hostnames and FQDNs, IPs and subnets, internal domains and URLs, cluster, tenant, customer, project and namespace names, usernames, emails, credentials and tokens, host-specific paths, and which products and network setup are in use. Describe them generically ("one cluster", "a DB host").

**Incorrect:**

```sh
glab mr create --title "fix(db): point the pool at db-01.internal.example.corp (10.20.0.5)"
```

**Correct:**

```sh
glab repo view -F json | jq -r .visibility     # public
glab mr create --title "fix(db): read the pool's host from the environment"
```

If something already leaked: stop and tell the user. The fix is a history rewrite plus recreating the repo, or the host's support; deleting a repo is the user's decision.

**How to check:** for a public repo, `scripts/scan.sh` with `REPO_PUBLIC=1` lists IPv4 addresses outside the documentation ranges, non-noreply emails and `INTERNAL_PATTERNS` matches in the commit messages, added lines and branch name, and, through `glab`, in the MR's title, description, source branch and notes. The `guard-public-text.mjs` hook (`assets/hooks/`) finds the visibility itself and, when it is public or unknown, refuses `glab mr create|update|note`, `glab release create`, `gh pr create|edit|comment` and `git push` whose text (inline, in the file it reads, or in the commits no remote has yet) has the same hits. Both are only as complete as `INTERNAL_PATTERNS`, and an IP-shaped version number is a false positive. Products and network setup described in prose, and anything already published, stay review.
