---
title: isPending disables the control; no separate saving state
impact: HIGH
tags: mutations
check: review
---

## isPending disables the control; no separate saving state

**Impact: HIGH**

**Incorrect:**

```tsx
const [saving, setSaving] = useState(false);
async function onSave() { setSaving(true); await save.mutateAsync(values); setSaving(false); }
```

**Correct:**

```tsx
<Button type="submit" disabled={save.isPending}>{t("save")}</Button>
```
