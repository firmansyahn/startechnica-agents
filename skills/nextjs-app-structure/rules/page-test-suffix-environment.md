---
title: The suffix picks the environment
impact: LOW
tags: testing
check: review
---

## The suffix picks the environment

**Impact: LOW**

`.test.ts` runs in the `node` project (no DOM), `.test.tsx` in the `dom` project (jsdom). A test that renders or touches `window` is `.tsx` even with no JSX; a pure-logic test is `.ts` so it doesn't pay for jsdom. Playwright specs are `.spec.ts` and never match Vitest.
