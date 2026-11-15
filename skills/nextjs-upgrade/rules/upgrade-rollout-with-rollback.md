---
title: Ship through staging with the previous image ready to roll back to
impact: HIGH
tags: upgrade, deploy, rollout
check: review
---

## Ship through staging with the previous image ready to roll back to

**Impact: HIGH** (the first production traffic finds what the baseline missed, and without a ready rollback the fix is made under pressure)

The upgraded build goes to staging first: production-like settings, the production image, the new Node. There it is compared with the baseline: routes, headers, images, the sign-in round trip, error rates and backend request rates. Production follows with the previous image tag written down. Rollback is redeploying that tag, then reverting the merge. During the rolling update, old and new pods serve side by side: pages of the old build reload on their next navigation, and their Server Actions fail with "server action not found" until reloaded (`nextjs-deploy` references/replicas.md). Details: [references/rollout.md](../references/rollout.md).

**Incorrect:**

```text
merge -> production deploy -> watch for errors
```

**Correct:**

```text
merge -> staging deploy -> baseline comparison on staging (routes, images, sign-in, error and request rates)
-> production deploy with the previous image tag noted -> watch for 1 day -> or redeploy the previous tag
```

**How to check:** the merge request or the report names the staging comparison and the image tag to roll back to.
