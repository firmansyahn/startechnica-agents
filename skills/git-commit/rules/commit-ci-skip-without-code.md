---
title: Use [ci skip] only on commits without code
impact: MEDIUM
tags: ci, pipeline, merge-request
check: review
---

## Use [ci skip] only on commits without code

**Impact: MEDIUM** (code reaches the integration branch untested, or an MR has no passing pipeline and can't be merged safely)

`[ci skip]` in a commit message stops GitLab from running a pipeline for that push. Use it for commits that change no code and go straight to a branch: docs, plans, agent skills. Never on a commit with code, and never on the head commit of an MR branch, where the merge waits for a green pipeline.

**Incorrect:**

```
fix(api): retry the upstream call on 503 [ci skip]
```

**Correct:**

```
docs(plans): add the analytics plan [ci skip]
fix(api): retry the upstream call on 503
```

**How to check:** `git log --format='%h %s' <base>..HEAD | grep -F '[ci skip]'`, then `git show --stat <h>` for each: only docs and agent files.
