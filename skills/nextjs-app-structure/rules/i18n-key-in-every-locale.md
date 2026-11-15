---
title: Every key exists in every locale
impact: MEDIUM
tags: strings
check: test
---

## Every key exists in every locale

**Impact: MEDIUM**

Adding a key means adding it to every locale file in the same change. `nextjs-app-structure/templates/locale-parity.test.ts` checks locale parity and that every literal `t("key")` exists.

**How to check:** `templates/locale-parity.test.ts` fails on a key missing from a locale and on a literal `t("key")` that no locale has. Keys built at runtime aren't seen: check those in review.
