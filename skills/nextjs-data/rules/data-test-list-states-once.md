---
title: Lists test their loading, empty and error rows once
impact: MEDIUM
tags: testing
check: review
---

## Lists test their loading, empty and error rows once

**Impact: MEDIUM**

Each list component has one test per state, through the real query and a fake answer (an empty page, a 500). Pages built on that component don't repeat them.
