---
title: A second locale renders
impact: LOW
tags: testing
check: test
---

## A second locale renders

**Impact: LOW**

One test renders the page in a second locale, so a missing key or a hard-coded string shows up.

**How to check:** `templates/page-tests.test.ts` fails on a `page.test.tsx` with no render through the wrapper with a second locale and its messages (the kit's `renderWithQuery(ui, { locale: "de", msgs: de })`; set the option names at the top). It runs once `src/messages/` holds a second locale; a `ONE_LOCALE` list with reasons fails when stale.
