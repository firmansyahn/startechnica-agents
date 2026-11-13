---
title: Health probes are silent
impact: MEDIUM
tags: logging
check: review
---

## Health probes are silent

**Impact: MEDIUM**

`/livez` and `/readyz` log nothing on success; an orchestrator calls them every few seconds.
