---
title: Empty lists are [], never null
impact: MEDIUM
tags: lists, go, json
check: test
---

## Empty lists are [], never null

**Impact: MEDIUM** (a `null` where the document says array crashes the frontend's `.map`)

A Go `nil` slice marshals to `null`; the document says `array`, and the frontend's `.map` crashes. Make the empty slice explicitly (`go-code-style`).

**Incorrect:**

```go
var rows []Item                          // stays nil when the query finds nothing → "data": null
```

**Correct:**

```go
rows := make([]Item, 0, limit)
```

**How to check:** the reply check fails on `null` for an array field; a test calls each list with no matches.
