---
title: Other refusals show inside the form, and the form stays open
impact: MEDIUM
tags: validation
check: review
---

## Other refusals show inside the form, and the form stays open

**Impact: MEDIUM**

A 403, 409 or network failure goes to `form.setError("root", ...)` and the form-level notice composite, inside the open form or drawer, with the user's values intact. The mutation opts out of its error toast (`failure: false`) so the refusal isn't shown twice. A 401 has already sent the user to sign in; don't render it.
