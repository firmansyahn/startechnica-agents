---
title: className on primitives is for layout
impact: MEDIUM
tags: shadcn, primitives, tailwind
check: review
---

## `className` on primitives is for layout

**Impact: MEDIUM** (restyled primitives drift from the design system and repeat the same class lists across pages)

On a primitive (Button, Card, Input, Badge), `className` sets margins, width, grid placement and alignment. Look, color and size come from its `variant` and `size` props; a missing look is a new variant or a composite, not a class list repeated in pages.

**Incorrect:**

```tsx
<Button className="bg-destructive text-white h-8 px-2 rounded-sm">Delete</Button>
```

**Correct:**

```tsx
<Button variant="destructive" size="sm" className="ml-auto">Delete</Button>
```

**How to check:** look for color, height, padding or radius classes passed to a primitive's `className` where a `variant` or `size` exists.
