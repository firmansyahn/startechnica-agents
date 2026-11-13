---
title: A Go PATCH type tells absent from null
impact: MEDIUM
tags: patch, go, json
check: review
---

## A Go PATCH type tells absent from null

**Impact: MEDIUM** (a pointer can't tell "clear the value" from "don't touch it")

A pointer decodes both an absent key and `null` to `nil`, so "clear the note" and "don't touch the note" look the same. Use an `Opt[T]` with its own `UnmarshalJSON` ([references/resources.md](../references/resources.md)).

**Incorrect:**

```go
type ItemPatch struct {
	Note *string `json:"note"`             // nil: absent or null?
}
```

**Correct:**

```go
type ItemPatch struct {
	Note Opt[string] `json:"note"`         // Set=false: absent; Set && Null: clear; else set Value
}
```

**How to check:** in review, PATCH input structs with pointer fields for nullable columns instead of `Opt[T]`.
