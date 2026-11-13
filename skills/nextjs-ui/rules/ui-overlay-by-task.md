---
title: Choose the overlay by what the user does in it
impact: MEDIUM
tags: overlays, dialogs, sheets
check: review
---

## Choose the overlay by what the user does in it

**Impact: MEDIUM** (the wrong overlay for the task: cramped forms in dialogs, questions in toasts, nested dialogs)

| The user... | Use |
|---|---|
| Creates or edits a record with several fields | Sheet (drawer) from the side, via the form drawer composite |
| Answers a short question or confirms | AlertDialog via the confirm composite |
| Reads or edits something small without leaving context | Dialog |
| Picks from options or sets a filter | Popover, DropdownMenu, Select, Combobox |
| Needs a hint on hover/focus | Tooltip |
| Learns an action finished | Toast |

Don't nest dialogs; a second step replaces the content or closes the first.

**How to check:** check each new overlay against the table: multi-field forms in the form drawer, confirmations in the confirm composite, no dialog opened from a dialog.
