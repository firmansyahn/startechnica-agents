---
title: Every page has a page test
impact: LOW
tags: testing
check: test, review
---

## Every page has a page test

**Impact: LOW**

`page.test.tsx` renders the client component through the test wrapper (fresh query client, messages, fake network) and covers at least: the read call it makes, a successful write's call and body, a validation error, and the read-only user.

**How to check:** `templates/page-tests.test.ts` fails on an `app/**/page.tsx` with no `page.test.tsx` beside it; an `EXEMPT` list with reasons (a redirect, a static page) fails when stale. It checks only that the test exists: the four cases it covers stay review.
