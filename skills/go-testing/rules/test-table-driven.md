---
title: Write table tests with tt, give/want and t.Run
impact: LOW
tags: tests, style
check: review
---

## Write table tests with tt, give/want and t.Run

**Impact: LOW** (copy-pasted cases drift apart; a failure doesn't say which case broke)

Cases that differ only in input and output go in a table: slice `tests`, loop variable `tt`, fields `name`, `give…`, `want…`, run with `t.Run(tt.name, ...)`. Failure messages name the input, the got and the want. Split the table once cases need conditional setup or behaviour flags (`shouldCallX`); separate tests are clearer than a table with branches.

**Incorrect:**

```go
if got := normalizeMAC("AA-BB-CC-DD-EE-FF"); got != "aa:bb:cc:dd:ee:ff" {
	t.Error("bad")
}
if got := normalizeMAC("aabb.ccdd.eeff"); got != "aa:bb:cc:dd:ee:ff" {
	t.Error("bad")
}
```

**Correct:**

```go
tests := []struct {
	name string
	give string
	want string
}{
	{"dashes", "AA-BB-CC-DD-EE-FF", "aa:bb:cc:dd:ee:ff"},
	{"cisco dots", "aabb.ccdd.eeff", "aa:bb:cc:dd:ee:ff"},
}
for _, tt := range tests {
	t.Run(tt.name, func(t *testing.T) {
		if got := normalizeMAC(tt.give); got != tt.want {
			t.Errorf("normalizeMAC(%q) = %q, want %q", tt.give, got, tt.want)
		}
	})
}
```

**How to check:** in review, repeated assertion blocks that differ only in values, and failure messages without the input and the values.
