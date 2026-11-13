---
title: Money is never a float
impact: HIGH
tags: money, json
check: review
---

## Money is never a float

**Impact: HIGH** (a float amount rounds on one side or the other eventually)

An integer of minor units with the currency (`{ "amount": 1250, "currency": "USD" }`), or a decimal string. `12.5` as a JSON number rounds on one side or the other eventually.

**How to check:** in review, `type: number` money fields in the document, or `float64` amounts in Go reply types.
