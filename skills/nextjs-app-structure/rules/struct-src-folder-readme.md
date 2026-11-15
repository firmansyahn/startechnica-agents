---
title: A new src folder gets a README
impact: LOW
tags: folders
check: test, review
---

## A new src folder gets a README

**Impact: LOW**

Two lines: what goes in, how to import it, and a link to the project rule. Without it the folder collects the wrong things within weeks.

**How to check:** `templates/src-layout.test.ts` ("has a README in every src folder") fails on a direct subfolder of `src/` with no `README.md`. What the README says stays review.
