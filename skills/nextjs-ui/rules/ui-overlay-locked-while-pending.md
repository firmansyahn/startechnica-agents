---
title: An overlay with a pending write can't be dismissed
impact: MEDIUM
tags: overlays, mutations
check: review
---

## An overlay with a pending write can't be dismissed

**Impact: MEDIUM** (the user closes the overlay mid-save and never sees whether it worked)

While its save or delete is in flight, Save and Cancel are disabled and Escape/outside-press close requests are ignored (control `open` and ignore `onOpenChange(false)` while pending), so the outcome isn't lost.

**Incorrect:**

```tsx
<Sheet open={open} onOpenChange={setOpen}>      {/* Escape closes mid-save */}
```

**Correct:**

```tsx
<Sheet open={open} onOpenChange={(next) => { if (!save.isPending) setOpen(next); }}>
```

**How to check:** check overlays that save or delete: `onOpenChange` ignores closing while `isPending`, and Save and Cancel are disabled.
