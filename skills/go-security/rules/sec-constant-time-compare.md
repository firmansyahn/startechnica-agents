---
title: Compare secrets in constant time
impact: HIGH
tags: security, timing, tokens, hmac
check: scan (candidates)
---

## Compare secrets in constant time

**Impact: HIGH** (`==` stops at the first differing byte, so response timing leaks how much of a guess was right)

API keys, shared secrets, HMAC signatures, webhook signatures and token hashes are compared with `subtle.ConstantTimeCompare` or `hmac.Equal`. Better, look the secret up by a hash (store `sha256(token)`, query by it), so no comparison of the raw secret happens at all. Passwords use the password hash's own compare (`bcrypt.CompareHashAndPassword`, argon2id).

**Incorrect:**

```go
if r.Header.Get("X-Signature") != computeSignature(body, secret) {
	http.Error(w, "bad signature", http.StatusUnauthorized)
	return
}
```

**Correct:**

```go
got, err := hex.DecodeString(r.Header.Get("X-Signature"))
if err != nil || !hmac.Equal(got, computeMAC(body, secret)) {
	http.Error(w, "bad signature", http.StatusUnauthorized)
	return
}
```

**How to check:** `scripts/scan.sh` flags `==`/`!=` and `bytes.Equal` between variables whose names mention token, secret, signature, HMAC, digest or API key (comparisons with literals, `nil` and `""` are skipped). Comparing a token *type* or a non-secret id is fine.
