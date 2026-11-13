---
title: Headings follow the page hierarchy
impact: MEDIUM
tags: layout, accessibility, headings
check: review
---

## Headings follow the page hierarchy

**Impact: MEDIUM** (screen-reader users lose the page outline)

One `h1` per page (from the page title), then `h2` for sections, `h3` inside them, without skipping levels. Choose the level for structure and the size with classes; use `render={<h2 />}` on parts that render headings (accordion headers, card titles) when the default level is wrong.

**How to check:** check one `h1` per page, then `h2`/`h3` without skipped levels (an accessibility audit or `getAllByRole("heading")`).
