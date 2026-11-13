---
title: Destructive confirmations use the confirm composite
impact: MEDIUM
tags: overlays, confirmations
check: review
---

## Destructive confirmations use the confirm composite

**Impact: MEDIUM** (confirmations look and behave differently on every page, and an "OK" button doesn't say what it does)

One API for every "are you sure": `if (!(await confirm({ title, description, destructive: true }))) return;`. The confirm button names the action ("Delete customer"), not "OK"; the destructive variant marks it. Never `window.confirm`.

**How to check:** look for hand-built AlertDialogs around deletes, confirm buttons labelled "OK" or "Yes", and `window.confirm`.
