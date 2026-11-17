---
title: Name every client with the service's app name
impact: MEDIUM
tags: mongodb, settings, observability
check: scan (candidates), test, review
---

## Name every client with the service's app name

**Impact: MEDIUM** (without one, the server's logs, `currentOp`, slow-query entries and profiler show only an IP address: a slow or runaway query can't be traced back to the service that sent it)

Every client sets `SetAppName(cfg.AppName)`, and the settings check refuses an empty `app_name` at startup. The name is the service's, the same on every replica (`orders-service`), with the role appended when one service runs several clients (`orders-service-worker`). It labels connections; it is not an identity: any client can claim any name, so who the service is comes from its login (`mongo-authenticated-connection`). Set it in code after `ApplyURI`, so an `appName` left in a shared URI can't mislabel the service.

**Incorrect:**

```go
opts := options.Client().ApplyURI(uri).SetTimeout(cfg.Timeout) // the server sees only the client's address
```

**Correct:**

```go
// in validate
if m.AppName == "" {
	return fail("app_name is required: the service's name, e.g. orders-service")
}

// when building the client
opts := options.Client().ApplyURI(uri).
	SetAppName(cfg.AppName).
	SetTimeout(cfg.Timeout)
```

**How to check:** `scripts/scan.sh` flags a `mongo.Connect` in a module where nothing calls `SetAppName(`. A settings test asserts that `validate` refuses an empty `app_name`. In review, check that the name is the service's, not a pod or a random value.
