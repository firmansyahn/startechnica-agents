---
title: Every visited page gets an accessibility scan
impact: MEDIUM
tags: scope-and-ci
check: review
---

## Every visited page gets an accessibility scan

**Impact: MEDIUM**

An `@a11y` spec runs `AxeBuilder` with the WCAG A/AA tags on each page the suite visits, loaded and with its main dialog open, in light and dark. Exclusions are specific selectors with a reason; known legacy violations live in a baseline that only shrinks.
