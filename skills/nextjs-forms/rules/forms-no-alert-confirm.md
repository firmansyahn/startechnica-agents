---
title: Use the confirm dialog and toasts, never alert() or confirm()
impact: MEDIUM
tags: forms, dialogs, feedback
check: scan, eslint
---

## Use the confirm dialog and toasts, never alert() or confirm()

**Impact: MEDIUM** (blocking native dialogs: unstyled, untranslatable, untestable, blocked in some embeds)

Questions go through the project's confirm dialog composite; feedback goes through the mutation-feedback toast or an in-form notice.

**Incorrect:**

```tsx
if (!window.confirm("Delete this customer?")) return;
alert("Saved");
```

**Correct:**

```tsx
if (!(await confirm({ title: t("deleteCustomer"), destructive: true }))) return;
// success toast comes from useFeedbackMutation
```

**How to check:** `assets/eslint.config.mjs` bans the `alert`, `confirm` and `prompt` globals and their `window.`/`globalThis.`/`self.` forms in `app/`, `components/` and `src/` (a local `confirm` from the confirm-dialog hook is not a global, so it passes). `scripts/scan.sh` flags them too.
