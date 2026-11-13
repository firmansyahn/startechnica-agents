---
title: No top-level twins of src folders
impact: LOW
tags: folders
check: review
---

## No top-level twins of src folders

**Impact: LOW**

`hooks/`, `utils/`, `types/`, `services/`, `lib/` exist only under `src/`. A second `utils/` at `<app-root>` splits the same kind across two places and two aliases; move its files into `src/utils/` (or `src/libs/` when they do I/O).
