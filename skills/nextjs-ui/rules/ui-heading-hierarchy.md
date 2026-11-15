---
title: Headings follow the page hierarchy
impact: MEDIUM
tags: layout, accessibility, headings
check: test, review
---

## Headings follow the page hierarchy

**Impact: MEDIUM** (screen-reader users lose the page outline)

One `h1` per page (from the page title), then `h2` for sections, `h3` inside them, without skipping levels. Choose the level for structure and the size with classes; use `render={<h2 />}` on parts that render headings (accordion headers, card titles) when the default level is wrong.

**How to check:** `assets/tests/axe.ts` (`await expectAccessible()` in each page test, after the page has loaded) runs axe's `page-has-heading-one`, `heading-order` and `empty-heading` on the rendered document; `heading-order` is a best-practice rule, so it is named explicitly. `nextjs-app-structure` `templates/page-tests.test.ts` fails on a page test that doesn't call it. It sees only what the test renders; whether a level was chosen for structure rather than size stays review.
