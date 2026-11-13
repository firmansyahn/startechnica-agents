---
title: Icon color comes from the text token
impact: LOW
tags: icons, colors, themes
check: review
---

## Icon color comes from the text token

**Impact: LOW** (icons keep a palette color that breaks in dark mode and presets)

Icons use `currentColor`. Color the text or the container (`text-muted-foreground`, `text-success`), not the icon with a palette class.

**Incorrect:**

```tsx
<CheckIcon className="text-green-600" />
```

**Correct:**

```tsx
<span className="inline-flex items-center gap-1 text-success"><CheckIcon />{t("active")}</span>
```

**How to check:** search for palette `text-*` classes on icon components.
