---
title: Everything works with the keyboard
impact: HIGH
tags: accessibility, keyboard
check: review
---

## Everything works with the keyboard

**Impact: HIGH** (keyboard and assistive-technology users can't reach or trigger the action)

Every action reachable by mouse is reachable with Tab, Enter/Space and arrow keys. No `onClick` on `div`/`span`/`tr`; use a button or link (or `render` with `nativeButton={false}` where a part needs another element). Don't stop keyboard events the primitives rely on.

**Incorrect:**

```tsx
<div onClick={open} className="cursor-pointer">Open</div>
```

**Correct:**

```tsx
<Button variant="ghost" onClick={open}>{t("open")}</Button>
```

**How to check:** search for `onClick` on `div`, `span` and `tr`, and tab through the page.
