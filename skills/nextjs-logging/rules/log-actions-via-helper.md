---
title: Actions log once, in the shared helper
impact: MEDIUM
tags: logging
check: review
---

## Actions log once, in the shared helper

**Impact: MEDIUM**

`apiAction` logs the action name, outcome (`ok` or status) and duration for every action. Individual actions don't add their own lines, and never log their input or output.
