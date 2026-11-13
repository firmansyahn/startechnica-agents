---
title: Generate secrets with crypto/rand
impact: CRITICAL
tags: security, randomness, tokens
check: scan, lint (gosec G404)
---

## Generate secrets with crypto/rand

**Impact: CRITICAL** (predictable tokens, session ids, OTPs or reset codes can be guessed)

Anything an attacker must not guess (tokens, session ids, API keys, nonces, salts, one-time codes, invite codes) comes from `crypto/rand`. `math/rand` and `math/rand/v2` are for jitter, sampling and tests. For a numeric code use `rand.Int` from `crypto/rand`; for a token, `rand.Text()` (Go 1.24+) or random bytes in base64url/hex.

**Incorrect:**

```go
import "math/rand/v2"

func otp() string { return fmt.Sprintf("%06d", rand.IntN(1_000_000)) }
```

**Correct:**

```go
import "crypto/rand"

func otp() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("otp: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func token() string { return rand.Text() } // 26 base32 characters, 128+ bits
```

**How to check:** `scripts/scan.sh` flags files that import `math/rand` and mention tokens, secrets, nonces, salts, passwords, OTPs or codes; read what the random value is used for.
