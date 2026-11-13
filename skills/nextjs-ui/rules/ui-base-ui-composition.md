---
title: Compose Base UI parts with render, and set nativeButton for non-buttons
impact: MEDIUM
tags: base-ui, shadcn, accessibility
check: scan
---

## Compose Base UI parts with render, and set nativeButton for non-buttons

**Impact: MEDIUM** (Radix props silently ignored; a link or div trigger loses keyboard and ARIA behaviour)

In a Base UI project, parts compose through `render`, never `asChild`. When the rendered element isn't a `<button>` (a link, a `div`), set `nativeButton={false}`. Components passed to `render` forward their ref and spread all props.

**Incorrect:**

```tsx
<DialogTrigger asChild><Button>Open</Button></DialogTrigger>
<MenuItem render={<Link href="/x" />}>Open</MenuItem>      {/* item expecting a button */}
```

**Correct:**

```tsx
<DialogTrigger render={<Button />}>Open</DialogTrigger>
<Button render={<Link href="/x" />} nativeButton={false}>Open</Button>
```

**How to check:** `scripts/scan.sh` flags `asChild` when `@base-ui/react` is a dependency, and `render={<Link` / `render={<a` without `nativeButton` on the same element.
