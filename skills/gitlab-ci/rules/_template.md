---
title: Rule title in the imperative
impact: CRITICAL | HIGH | MEDIUM | LOW
tags: tag1, tag2
check: lint | dry-run | review (what catches a violation today)
---

## Rule title in the imperative

**Impact: HIGH** (one phrase: what goes wrong when it's broken)

Two or three sentences: the rule and why it matters.

**Incorrect (what's wrong):**

```yaml
# smallest example that shows the violation
```

**Correct:**

```yaml
# the same example, fixed
```

**How to check:** the `glab ci lint` run, the pipeline to read, or what to look for in review.
