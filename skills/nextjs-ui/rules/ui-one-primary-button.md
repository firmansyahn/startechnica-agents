---
title: One primary button per view
impact: LOW
tags: buttons, hierarchy
check: review
---

## One primary button per view

**Impact: LOW** (users can't tell which action is the main one)

The one next action uses the default variant. Cancel/back is `outline` or `ghost`, row actions are `ghost` icon buttons, inline navigation is `link`, delete is `destructive`.

**Incorrect:**

```tsx
<Button>Cancel</Button><Button>Save draft</Button><Button>Publish</Button>
```

**Correct:**

```tsx
<Button variant="ghost">Cancel</Button><Button variant="outline">Save draft</Button><Button>Publish</Button>
```

**How to check:** look for more than one default-variant `Button` in one view or footer.
