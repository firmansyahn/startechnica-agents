---
title: A bot opens updates, and lockfile maintenance runs weekly
impact: MEDIUM
tags: dependencies
check: review
---

## A bot opens updates, and lockfile maintenance runs weekly

**Impact: MEDIUM**

Renovate (or Dependabot): grouped minor/patch updates on a schedule, majors one at a time, security updates immediately, weekly lockfile maintenance so transitive fixes land. Every update runs the full pipeline.
