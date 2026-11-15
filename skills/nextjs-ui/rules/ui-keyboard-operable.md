---
title: Everything works with the keyboard
impact: HIGH
tags: accessibility, keyboard
check: eslint, review
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

**How to check:** The kit's `eslint.config.mjs` (nextjs-new-app) reports `onClick` on `div`, `span`, `li`, `td` and `TableCell` (on rows: ui-table-row-actions), and with jsx-a11y (`click-events-have-key-events`, `no-static-element-interactions`, `no-noninteractive-element-interactions`) click handlers on other HTML elements without a role and key handler. Stopped key events and the focus order stay review: tab through the page.
