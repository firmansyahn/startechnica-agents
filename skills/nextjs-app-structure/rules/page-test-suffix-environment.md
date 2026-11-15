---
title: The suffix picks the environment
impact: LOW
tags: testing
check: test, review
---

## The suffix picks the environment

**Impact: LOW**

`.test.ts` runs in the `node` project (no DOM), `.test.tsx` in the `dom` project (jsdom). A test that renders or touches `window` is `.tsx` even with no JSX; a pure-logic test is `.ts` so it doesn't pay for jsdom. Playwright specs are `.spec.ts` and never match Vitest.

**How to check:** `templates/test-layout.test.ts` fails on a `.test.ts` that imports Testing Library, renders, queries `screen` or touches `window`/`document` (strings and comments ignored), and on any `.test.ts(x)` that imports `@playwright/test`. A `.test.tsx` that never touches the DOM (it only costs time) stays review.
