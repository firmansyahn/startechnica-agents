---
title: Path segments are encoded and checked
impact: HIGH
tags: actions
check: review
---

## Path segments are encoded and checked

**Impact: HIGH**

Ids go into backend paths through `encodeURIComponent`, and the action refuses one that decodes to `/`, `..` or a control character, so an id can't point the call at another endpoint.

**Incorrect:**

```ts
apiAction("PATCH", `items/${id}`, { body });
```

**Correct:**

```ts
apiAction("PATCH", `items/${segment(id)}`, { body });   // segment(): encodeURIComponent, refuses "..", "/", control chars
```
