---
title: Levels mean something
impact: MEDIUM
tags: logging
check: review
---

## Levels mean something

**Impact: MEDIUM**

`error`: someone has to act (a bug, a broken invariant). `warn`: a handled degradation (backend 5xx, refused refresh, reply that failed validation). `info`: lifecycle and notable business events (sign-in, sign-out, settings changed). `debug`: development. A refused write (422, 403, 409) is a normal outcome, at most `warn`, never `error`.
