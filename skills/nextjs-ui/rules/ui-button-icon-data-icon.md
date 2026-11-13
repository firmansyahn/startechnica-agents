---
title: Icons in buttons use data-icon, no size classes
impact: LOW
tags: icons, buttons
check: review
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

**How to check:** look for icons inside `Button` with `mr-*`, `ml-*`, `h-*`, `w-*` or `size-*` and no `data-icon`.
