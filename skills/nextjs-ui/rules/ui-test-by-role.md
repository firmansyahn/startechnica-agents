---
title: Tests query by role and name
impact: LOW
tags: accessibility, testing
check: eslint, review
---

## Tests query by role and name

**Impact: LOW** (elements only a test id can find are invisible to assistive technology too)

`getByRole("button", { name: "Save" })`, `getByRole("dialog", { name: "Edit customer" })`, `getByLabelText("Email")`. If a test can only find an element by test id or class, users of assistive technology can't find it either.

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports, in its unit-test block (eslint-plugin-testing-library), `container` from `render`, DOM traversal such as `querySelector` (`testing-library/no-node-access`) and, under the ID page-test-query-by-role, `*ByTestId` queries in `*.test.ts(x)`. Class selectors passed to other helpers stay review.
