---
title: First load shows a skeleton of the content, not a spinner page
impact: MEDIUM
tags: states, loading
check: review
---

## First load shows a skeleton of the content, not a spinner page

**Impact: MEDIUM** (the page jumps when content arrives, and the header and layout vanish while loading)

While `isPending`, render `Skeleton`s in the shape of what will appear (rows, cards, fields), inside the real page layout and header.

**Incorrect:**

```tsx
if (list.isPending) return <div className="flex h-screen items-center justify-center"><Spinner /></div>;
```

**Correct:**

```tsx
<PageTitle title={t("customers")} />
<Table>... {list.isPending ? <TableRowState state="loading" colSpan={5} /> : rows}</Table>
```

**How to check:** look for early returns of a full-page spinner on `isPending`.
