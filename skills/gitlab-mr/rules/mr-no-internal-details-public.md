---
title: Keep internal details out of public MRs
impact: CRITICAL
tags: security, public, disclosure
check: scan, review
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

**How to check:** grep the staged diff, the commit messages and the MR description for the project's known internal names, IPv4 addresses, emails and non-public domains before posting.
