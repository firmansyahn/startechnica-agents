---
title: PATCH sends only changed fields; absent and null differ
impact: MEDIUM
tags: patch, forms, merge-patch
check: test
---

## PATCH sends only changed fields; absent and null differ

**Impact: MEDIUM** (sending the whole form overwrites fields someone else changed meanwhile)

Absent = unchanged, `null` = clear, a value = set (JSON Merge Patch). The frontend sends the form's dirty fields only (`nextjs-forms` `pickDirty`); sending the whole form overwrites a field someone else changed meanwhile.

**Incorrect:**

```ts
saveItem({ id, changes: form.getValues(), scope });
```

**Correct:**

```ts
saveItem({ id, changes: pickDirty(form.getValues(), form.formState.dirtyFields), scope });
```

**How to check:** an edit-form test asserts the PATCH body holds only the edited fields.
