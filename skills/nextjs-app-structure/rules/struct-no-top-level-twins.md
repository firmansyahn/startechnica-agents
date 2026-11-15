---
title: No top-level twins of src folders
impact: LOW
tags: folders
check: test
---

## No top-level twins of src folders

**Impact: LOW**

`hooks/`, `utils/`, `types/`, `services/`, `lib/` exist only under `src/`. A second `utils/` at `<app-root>` splits the same kind across two places and two aliases; move its files into `src/utils/` (or `src/libs/` when they do I/O).

**How to check:** `templates/src-layout.test.ts` ("has no top-level twin of a src folder") fails on a top-level folder that duplicates a `src/` kind, `lib/` included.
