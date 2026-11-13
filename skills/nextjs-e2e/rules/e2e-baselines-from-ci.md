---
title: Baselines come from the CI image
impact: LOW
tags: visual
check: review
---

## Baselines come from the CI image

**Impact: LOW**

Fonts and anti-aliasing differ per OS. Generate and update baselines inside the same Playwright Docker image CI uses (`yarn playwright test --update-snapshots`), never from a laptop; commit them per project (light and dark separately).
