---
title: Paint the theme before first render, with one owner for .dark
impact: LOW
tags: themes, hydration
check: review
---

## Paint the theme before first render, with one owner for .dark

**Impact: LOW** (a flash of the wrong theme on every load; hydration warnings)

Either next-themes owns `.dark`, or the server stamps it from a cookie plus one constant inline script resolves `system`, never both. Preset and font attributes are stamped by the server. `suppressHydrationWarning` sits on `<html>` only.

**Incorrect:**

```tsx
useEffect(() => { document.documentElement.classList.toggle("dark", prefs.mode === "dark"); }, [prefs]);
```

**Correct:**

```tsx
<html {...attrs} className={cn(fonts, dark && "dark")} suppressHydrationWarning>
  <head><script dangerouslySetInnerHTML={{ __html: MODE_SCRIPT }} /></head>
```

**How to check:** look for `classList` changes to `dark` in effects, and for both next-themes and a custom mode script in the same app.
