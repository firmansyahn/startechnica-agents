---
title: Submit stays enabled while the form is invalid
impact: MEDIUM
tags: validation
check: eslint
---

## Submit stays enabled while the form is invalid

**Impact: MEDIUM**

Disable Save only while the mutation is pending. A disabled-while-invalid button gives no hint what's wrong; a submit runs validation and shows every error, focused on the first.

**Incorrect:**

```tsx
<Button type="submit" disabled={!form.formState.isValid}>{t("save")}</Button>
```

**Correct:**

```tsx
<Button type="submit" disabled={save.isPending}>{t("save")}</Button>
```

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags `isValid` anywhere in a `disabled` prop in pages and components. It misses `isValid` copied to another variable first.
