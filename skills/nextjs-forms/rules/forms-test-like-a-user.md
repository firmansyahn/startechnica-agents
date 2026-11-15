---
title: Drive the form like a user
impact: LOW
tags: testing
check: eslint, review
---

## Drive the form like a user

**Impact: LOW**

Type with `userEvent`, pick options by role and name, submit by clicking the button. Calling `form.setValue` or the submit handler directly skips the bindings the test should cover.

**Incorrect:**

```tsx
act(() => form.setValue("name", "North"));
await onSubmit();
```

**Correct:**

```tsx
await user.type(screen.getByLabelText("Name"), "North");
await user.click(screen.getByRole("button", { name: "Save" }));
```

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports `fireEvent` in `*.test.ts(x)` (`testing-library/prefer-user-event`, in its unit-test block). Calls to `form.setValue` or the submit handler in a test stay review.
