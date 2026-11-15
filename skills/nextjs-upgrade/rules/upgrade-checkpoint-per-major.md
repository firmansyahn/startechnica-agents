---
title: Commit each crossed major's changes as one checkpoint
impact: MEDIUM
tags: upgrade, commits, review
check: review
---

## Commit each crossed major's changes as one checkpoint

**Impact: MEDIUM** (one commit holding three majors' changes can't be bisected or reviewed against a guide)

Going straight from 12 to 16 still crosses 13, 14, 15 and 16. Each crossed major's codemods and manual changes form one commit, in order, named for the major. The runtime bump and each library upgrade are commits of their own. The build only has to pass at the end, but a commit never mixes two majors.

**Incorrect:**

```text
git log --oneline
a1b2c3d build(web): upgrade next to 16
```

**Correct:**

```text
git log --oneline
f6e5d4c build(web): upgrade @tanstack/react-query for next 16
e5d4c3b build(web): apply next 16 changes (proxy, eslint cli, turbopack)
d4c3b2a build(web): apply next 15 changes (async request apis, react 19)
c3b2a19 build(web): apply next 14 changes (next/og, viewport export)
b2a1908 build(web): apply next 13 changes (new-link, next/image)
a190807 build(web): install next 16.4 and react 19
9080706 build(web): raise node to 24
```

**How to check:** read the branch log: one commit per crossed major, each touching only what that major's guide lists.
