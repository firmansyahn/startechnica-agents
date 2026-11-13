---
title: Every key exists in every locale
impact: MEDIUM
tags: strings
check: review
---

## Every key exists in every locale

**Impact: MEDIUM**

Adding a key means adding it to every locale file in the same change. `nextjs-app-structure/templates/locale-parity.test.ts` checks locale parity and that every literal `t("key")` exists.
