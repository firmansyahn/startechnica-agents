---
title: No size classes on icons inside primitives
impact: LOW
tags: icons, shadcn
check: eslint
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

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports `size-*`, `h-*`, `w-*` and margin classes on an `*Icon` placed in a menu, select, command, menubar, badge, alert, tab or sidebar item, directly or inside a `{...}` expression. Icons without the `Icon` suffix, and items whose icon comes from another component, aren't seen.
