---
title: Row actions sit in the last column as ghost icon buttons or a menu
impact: MEDIUM
tags: tables, actions, accessibility
check: review
---

## Row actions sit in the last column as ghost icon buttons or a menu

**Impact: MEDIUM** (row clicks don't work with the keyboard or middle-click, and actions move around between tables)

One or two actions: ghost icon buttons with `aria-label`s. More: a `DropdownMenu` behind a "more" icon button. Delete is last and destructive. A row click that opens the record is a link on the primary cell, not a click handler on the `<tr>`, so it works with the keyboard and middle-click.

**How to check:** look for `onClick` on `TableRow`/`<tr>`, unnamed icon buttons, and delete not last.
