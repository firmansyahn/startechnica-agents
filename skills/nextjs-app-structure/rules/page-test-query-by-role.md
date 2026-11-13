---
title: Query by role and name
impact: LOW
tags: testing
check: review
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
