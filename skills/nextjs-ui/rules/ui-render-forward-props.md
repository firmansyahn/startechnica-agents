---
title: Components passed to render forward refs and spread props
impact: MEDIUM
tags: base-ui, react, accessibility
check: review
---

## Components passed to `render` forward refs and spread props

**Impact: MEDIUM** (focus, ARIA attributes and event handlers never reach the DOM element)

A custom component used in `render` must accept a `ref` (a prop in React 19) and spread every received prop onto its DOM element; otherwise focus, ARIA and event handlers are lost.

**Incorrect:**

```tsx
function IconLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href}>{children}</Link>;
}
```

**Correct:**

```tsx
function IconLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} />;
}
```

**How to check:** open each custom component used in `render={...}` and check it spreads its props onto the element (refs are props in React 19).
