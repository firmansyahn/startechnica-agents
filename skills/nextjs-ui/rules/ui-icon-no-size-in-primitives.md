---
title: No size classes on icons inside primitives
impact: LOW
tags: icons, shadcn
check: review
---

## No size classes on icons inside primitives

**Impact: LOW** (icons in menus, badges and tabs come out at different sizes)

Menu items, select items, badges, alerts, tabs and sidebar items size their icons. Add `size-*` only where an icon stands alone (an empty state, a stat card).

**Incorrect:**

```tsx
<DropdownMenuItem><PencilIcon className="mr-2 size-4" />Edit</DropdownMenuItem>
```

**Correct:**

```tsx
<DropdownMenuItem><PencilIcon />{t("edit")}</DropdownMenuItem>
```

**How to check:** look for `size-*`, `h-*`/`w-*` or margin classes on icons inside menu, select, badge, alert, tab and sidebar items.
