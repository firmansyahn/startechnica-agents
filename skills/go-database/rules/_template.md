---
title: Rule title in the imperative
impact: CRITICAL | HIGH | MEDIUM | LOW
tags: tag1, tag2
check: scan | vet | lint (<linter>) | test | review (what catches a violation today; several allowed)
---

## Rule title in the imperative

**Impact: HIGH** (one phrase: what goes wrong when it's broken)

Two or three sentences: the rule and why it matters.

**Incorrect (what's wrong):**

```go
// smallest example that shows the violation
```

**Correct:**

```go
// the same example, fixed
```

**How to check:** the scan check, linter, test, or what to look for in review.
