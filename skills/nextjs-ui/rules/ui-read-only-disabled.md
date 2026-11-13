---
title: Read-only users see disabled controls with a reason, not missing ones
impact: MEDIUM
tags: states, permissions
check: review
---

## Read-only users see disabled controls with a reason, not missing ones

**Impact: MEDIUM** (buttons vanish for read-only users, who then can't tell what the page does or why)

When the user may read but not write, write controls render disabled through the write-aware button composites (with a hint on why), so the page looks the same and nobody wonders where the button went. Controls the user can never use in this product (by plan or feature flag) are hidden instead.

**How to check:** render the page as a read-only user: write controls are disabled through the write-aware composites, not removed.
