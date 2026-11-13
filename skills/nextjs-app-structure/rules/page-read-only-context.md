---
title: Read-only users see disabled controls through one context
impact: MEDIUM
tags: pages
check: review
---

## Read-only users see disabled controls through one context

**Impact: MEDIUM**

A central write-permission context, fed by the same permission as the page's access entry, disables Add/Save/Import/Delete and row actions through the project's write-aware button. Pages don't check permissions themselves, except where the backend's write route needs a finer permission than the page's read.

**Incorrect:**

```tsx
{user.permissions.includes("items.write") && <Button onClick={openCreate}>{t("add")}</Button>}
```

**Correct:**

```tsx
<ButtonWrite onClick={openCreate}>{t("add")}</ButtonWrite>
```
