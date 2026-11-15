---
title: components/ holds React components only
impact: LOW
tags: folders
check: test, review
---

## components/ holds React components only

**Impact: LOW**

A hook, fetcher, constant list or type used by a component goes in its `src/` folder (or beside the component's one route), not into `components/` because a component imports it.

**How to check:** `templates/src-layout.test.ts` ("keeps components/ to React components") fails on a `.ts` file or a `use*` hook under `components/`; `*-variants.ts` and `index.ts` barrels are allowed, and a `COMPONENTS_ALLOWED` list with reasons fails when stale. A constant list or type declared inside a component's `.tsx` stays review.
