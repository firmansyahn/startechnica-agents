---
title: Wide tables scroll inside their container
impact: MEDIUM
tags: tables, responsive
check: test (e2e), review
---

## Wide tables scroll inside their container

**Impact: MEDIUM** (the whole page scrolls sideways on phones)

Wrap the table in an `overflow-x-auto` container so the page body never scrolls sideways; keep the first column readable on phones (or switch to a card list under `sm:` if the product needs it).

**How to check:** nextjs-e2e's [assets/layout.spec.ts](../../nextjs-e2e/assets/layout.spec.ts) loads each page in its `PAGES` list at 400 px and fails when the page scrolls sideways, naming the table (or other element) past the right edge; put every page with a wide table in the list. The shadcn `Table` wraps itself in an `overflow-x-auto` container, so the kit ESLint's check for raw `<table>` elements (`ui-table-primitive`) covers the static side. Whether the first column stays readable on phones stays review.
