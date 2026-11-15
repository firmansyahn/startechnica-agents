---
title: Icons in buttons use data-icon, no size classes
impact: LOW
tags: icons, buttons
check: eslint, review
---

## Icons in buttons use `data-icon`, no size classes

**Impact: LOW** (icon size and spacing drift from the button's own)

The button sizes and spaces its icon. Mark the position with `data-icon="inline-start"` or `"inline-end"`.

**Incorrect:**

```tsx
<Button><PlusIcon className="mr-2 h-4 w-4" />Add customer</Button>
```

**Correct:**

```tsx
<Button><PlusIcon data-icon="inline-start" />{t("addCustomer")}</Button>
<Button variant="ghost">{t("next")}<ArrowRightIcon data-icon="inline-end" /></Button>
```

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports `size-*`, `h-*`, `w-*` and margin classes on an `*Icon` inside a `Button*` component, directly or inside a `{...}` expression. Icons imported without the `Icon` suffix and a missing `data-icon` aren't reported; review those.
