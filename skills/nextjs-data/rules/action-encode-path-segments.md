---
title: Path segments are encoded and checked
impact: HIGH
tags: actions
check: eslint, review
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

**How to check:** the kit's `eslint.config.mjs` (`nextjs-new-app/assets`) flags a template path passed to `apiAction`, `read` or `readPage` (the `TRANSPORTS` list at its top) that interpolates a bare name or property (`${id}`, `${item.id}`) rather than a call (`${segment(id)}`). It misses a path built in a variable first, and can't tell `segment()` from any other call. Left to review: that `segment()` refuses `..`, `/` and control characters (a unit test of the helper).
