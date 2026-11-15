---
title: A baseline update is reviewed like code
impact: LOW
tags: visual
check: test (CODEOWNERS), review
---

## A baseline update is reviewed like code

**Impact: LOW**

Look at the diff image in the HTML report before updating; the updated PNGs are part of the merge request and the reviewer looks at them too.

**How to check:** [assets/tests/e2e-setup.test.ts](../assets/tests/e2e-setup.test.ts) fails when the config keeps baselines in `__screenshots__` (or such a folder exists) and no CODEOWNERS line owns them, for example `/**/__screenshots__/ @<team>`. Requiring the code owners' approval is a project setting (code owner approval on the protected branch); looking at the diff images stays review.
