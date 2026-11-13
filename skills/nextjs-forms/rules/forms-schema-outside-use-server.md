---
title: The schema lives outside the "use server" file
impact: MEDIUM
tags: validation
check: review
---

## The schema lives outside the "use server" file

**Impact: MEDIUM**

`src/services/<domain>/input.ts` (or a page's `schema.ts`), imported by both sides. A `"use server"` file may export only async functions (`nextjs-data` Server actions rules).
