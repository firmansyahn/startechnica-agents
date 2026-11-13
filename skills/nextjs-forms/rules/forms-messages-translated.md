---
title: Validation messages are translated
impact: MEDIUM
tags: validation
check: review
---

## Validation messages are translated

**Impact: MEDIUM**

Zod messages are translation keys rendered through a small `translate(fieldState.error)` wrapper, or the schema is built by a factory that receives `t` (`makeItemSchema(t)`), with the action using the default-locale build. Pick one per project; never show raw English keys or zod's default messages in a translated UI.
