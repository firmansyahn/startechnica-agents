---
title: Destructive confirmations use the confirm composite
impact: MEDIUM
tags: overlays, confirmations
check: eslint, review
---

## Destructive confirmations use the confirm composite

**Impact: MEDIUM** (confirmations look and behave differently on every page, and an "OK" button doesn't say what it does)

One API for every "are you sure": `if (!(await confirm({ title, description, destructive: true }))) return;`. The confirm button names the action ("Delete customer"), not "OK"; the destructive variant marks it. Never `window.confirm`.

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports an import of the AlertDialog primitive in `app/` (only the confirm composite in `components/` uses it), and `window.confirm` under forms-no-alert-confirm. Confirm buttons labelled "OK" or "Yes" stay review.
