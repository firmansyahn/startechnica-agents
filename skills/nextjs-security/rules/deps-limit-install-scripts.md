---
title: Install scripts run only where needed
impact: MEDIUM
tags: dependencies
check: review
---

## Install scripts run only where needed

**Impact: MEDIUM**

Consider `enableScripts: false` in `.yarnrc.yml` with `dependenciesMeta.<pkg>.built: true` for the packages that need their build step, so a compromised transitive package can't run code on `yarn install`.
