---
title: Tag every marshaled field
impact: MEDIUM
tags: style, json, go-nextjs-api-contract
check: lint (musttag), review
---

## Tag every marshaled field

**Impact: MEDIUM** (the wire name follows the Go field name, so a rename silently breaks clients and stored JSON; untagged fields marshal as `CreatedAt` where the contract says `created_at`)

Every field of a struct that is marshaled (JSON replies and requests, YAML config, form or query decoding) has an explicit tag; the tag is the contract. Fields that must not be marshaled get `json:"-"`. A reply that must send `[]` rather than `null` makes the empty slice explicitly.

**Incorrect:**

```go
type CustomerReply struct {
	ID        string
	Name      string
	CreatedAt time.Time
	Secret    string
}
```

**Correct:**

```go
type CustomerReply struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	Secret    string    `json:"-"`
}
```

**How to check:** `musttag` finds structs passed to `json.Marshal`/`Unmarshal`/`Encode`/`Decode` with untagged fields. In review, check new reply and request types and any field renamed in one.
