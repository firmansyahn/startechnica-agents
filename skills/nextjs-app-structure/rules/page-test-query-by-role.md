---
title: Query by role and name
impact: LOW
tags: testing
check: eslint, review
---

## Query by role and name

**Impact: LOW**

`getByRole("button", { name: "Save" })`, `getByRole("dialog", { name: "Edit customer" })`, `getByLabelText("Email")`. Test ids and class selectors are a last resort; needing one usually means the control lacks a name (`nextjs-ui` Accessibility rules).

**Incorrect:**

```tsx
await user.click(container.querySelector(".btn-save")!);
```

**Correct:**

```tsx
await user.click(screen.getByRole("button", { name: "Save" }));
```

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports, in its unit-test block (eslint-plugin-testing-library), `container` from `render` (`testing-library/no-container`), DOM traversal such as `querySelector` and `closest` (`testing-library/no-node-access`) and `*ByTestId` queries in `*.test.ts(x)`. A last-resort test id carries `// eslint-disable-next-line team/syntax-test -- <reason>`. Whether the queried name is the one users see stays review.
