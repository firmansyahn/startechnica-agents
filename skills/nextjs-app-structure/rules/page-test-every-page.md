---
title: Every page has a page test
impact: LOW
tags: testing
check: review
---

## Every page has a page test

**Impact: LOW**

`page.test.tsx` renders the client component through the test wrapper (fresh query client, messages, fake network) and covers at least: the read call it makes, a successful write's call and body, a validation error, and the read-only user.
