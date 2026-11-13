---
title: components/ holds React components only
impact: LOW
tags: folders
check: review
---

## components/ holds React components only

**Impact: LOW**

A hook, fetcher, constant list or type used by a component goes in its `src/` folder (or beside the component's one route), not into `components/` because a component imports it.
