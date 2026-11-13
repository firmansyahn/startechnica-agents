---
title: Settings pages use the settings hook
impact: MEDIUM
tags: pages
check: review
---

## Settings pages use the settings hook

**Impact: MEDIUM**

A single-record settings page uses `useSettingsPage(path)` (read, PATCH only the changed keys, update the cache) and the setting-row composites, instead of its own query, mutation and layout.
