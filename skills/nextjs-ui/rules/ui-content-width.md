---
title: Content width is constrained for reading
impact: LOW
tags: layout, typography
check: review
---

## Content width is constrained for reading

**Impact: LOW** (forms and text stretch across wide screens and become hard to read)

Forms and settings pages cap their width (`max-w-2xl`, `max-w-3xl`); long text stays under about 75 characters per line (`max-w-prose`). Lists and dashboards use the full width.

**How to check:** check forms and settings pages cap their width and long text uses `max-w-prose`.
