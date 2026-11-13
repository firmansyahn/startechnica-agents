---
title: Buttons show pending state through disabled and a spinner, not a prop
impact: MEDIUM
tags: buttons, mutations, loading
check: review
---

## Buttons show pending state through `disabled` and a spinner, not a prop

**Impact: MEDIUM** (an unknown prop does nothing, so the button stays clickable and double-submits)

Primitives have no `isLoading`. Disable while the mutation is pending and show the spinner icon inline; the label stays.

**Incorrect:**

```tsx
<Button isLoading={save.isPending}>Save</Button>
```

**Correct:**

```tsx
<Button type="submit" disabled={save.isPending}>
  {save.isPending && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
  {t("save")}
</Button>
```

**How to check:** search for `isLoading` or `loading` props on `Button`, and for submit buttons not disabled by `isPending`.
