---
title: Instrument the client with redisotel, without raw commands in spans
impact: HIGH
tags: redis, observability, tracing, privacy
check: scan, review
---

## Instrument the client with redisotel, without raw commands in spans

**Impact: HIGH** (`redisotel` records every command with its arguments in `db.statement` by default, so session tokens, emails and cached personal data are copied to the tracing backend)

Call `redisotel.InstrumentTracing` and `redisotel.InstrumentMetrics` once, on the client the process builds, and pass `redisotel.WithDBStatement(false)` to tracing: the span keeps the command name, the server and the duration, which is what a trace needs. Turn statements on only for a service whose keys and values hold nothing secret or personal, with a comment saying so. AUTH and HELLO are filtered by default; values are not.

**Incorrect:**

```go
if err := redisotel.InstrumentTracing(rdb); err != nil { // SET sessions:... <token> lands in every span
	return nil, err
}
```

**Correct:**

```go
if err := errors.Join(
	redisotel.InstrumentTracing(rdb, redisotel.WithDBStatement(false)),
	redisotel.InstrumentMetrics(rdb),
); err != nil {
	_ = rdb.Close()
	return nil, fmt.Errorf("instrument redis: %w", err)
}
```

**How to check:** `scripts/scan.sh` flags `redisotel.InstrumentTracing(` with no `WithDBStatement(false)` on the same or the next two lines. In review: a client with no instrumentation at all, a hook or log line that prints command arguments, and `sec-no-secrets-in-logs` ([go-security](../../go-security/SKILL.md)).
