---
title: Form-only rules extend the shared schema
impact: MEDIUM
tags: validation
check: review
---

## Form-only rules extend the shared schema

**Impact: MEDIUM**

A password confirmation or "accept terms" box isn't sent to the server. Add it in a form-level extension, with the refinement's `path` on the field that shows the error.

**Correct:**

```ts
const signUpForm = signUpSchema
  .extend({ confirm: z.string() })
  .refine((v) => v.confirm === v.password, { error: "Passwords don't match", path: ["confirm"] });
```
