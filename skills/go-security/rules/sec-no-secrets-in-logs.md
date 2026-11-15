---
title: Never log secrets, credentials or tokens
impact: HIGH
tags: security, logging, secrets
check: scan (candidates)
---

## Never log secrets, credentials or tokens

**Impact: HIGH** (logs are copied to many systems and kept for months; anyone with log access gets the credentials)

Passwords, tokens, API keys, client secrets, shared secrets, DSNs with passwords, and `Authorization`/`Cookie` headers never reach a log field, an error message that gets logged, or a `%+v` of a struct that holds them. Log an id, a hash prefix or a "present" flag instead. Structs that carry secrets implement `zapcore.ObjectMarshaler` (`MarshalLogObject`) leaving the secret out, or a redacting `String()` logged with `zap.Stringer`; `zap.Any` on a plain struct reflects every exported field.

**Incorrect:**

```go
log.Info("token refreshed", zap.String("refresh_token", tok.Refresh))
log.Debug("request", zap.Any("headers", r.Header))
return fmt.Errorf("connect %s: %w", cfg.DSN, err) // DSN carries the password
```

**Correct:**

```go
log.Info("token refreshed", zap.String("client_id", tok.ClientID))
log.Debug("request", zap.String("method", r.Method), zap.String("path", r.URL.Path))
return fmt.Errorf("connect %s: %w", cfg.RedactedDSN(), err)

func (c Credentials) MarshalLogObject(enc zapcore.ObjectEncoder) error {
	enc.AddString("client_id", c.ClientID) // ClientSecret left out
	return nil
}
```

**How to check:** `scripts/scan.sh` flags log calls whose line names a password, secret, token, API key, DSN, authorization or cookie; most hits are ids or flags, so read the value. Also look for whole headers, requests or config structs passed to the logger.
