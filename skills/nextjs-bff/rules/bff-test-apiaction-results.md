---
title: apiAction returns a Result for every outcome
impact: MEDIUM
tags: testing
check: review
---

## apiAction returns a Result for every outcome

**Impact: MEDIUM**

Success, a 422 with fields, a 403, a 409, a signed-out session and an unreachable backend (503) each come back as a `Result` of the right shape; none throws.
