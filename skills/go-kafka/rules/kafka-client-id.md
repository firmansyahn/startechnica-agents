---
title: Name every client with the service's client ID
impact: MEDIUM
tags: kafka, settings, observability, quotas
check: scan (candidates), test, review
---

## Name every client with the service's client ID

**Impact: MEDIUM** (without one, franz-go sends `kgo` for every service: broker logs, request metrics and throttling can't tell the services apart, and a client-ID quota can't single one out)

Every client sends `kgo.ClientID(cfg.ClientID)`, and the settings check refuses an empty `client_id` at startup. The ID is the service's name, the same on every replica (`orders-service`), with the role appended when one service runs several clients (`orders-service-relay`). It labels requests; it is not an identity: any client can claim any ID, so who the service is comes from its SASL login (`kafka-authenticated-connection`), and ACLs and quotas that matter are keyed on the user. Per-instance IDs are the instance ID and the transactional ID, never the client ID.

**Incorrect:**

```go
opts := []kgo.Opt{
	kgo.SeedBrokers(cfg.Brokers...),
	kgo.SASL(m), // no ClientID: the broker sees "kgo"
}
```

**Correct:**

```go
// in the config package's validate (references/config.md)
if k.ClientID == "" {
	return fail("client_id is required: the service's name, e.g. orders-service")
}

// in baseOpts
opts := []kgo.Opt{
	kgo.SeedBrokers(cfg.Brokers...),
	kgo.ClientID(cfg.ClientID),
	kgo.SASL(m),
}
```

**How to check:** `scripts/scan.sh` flags every `kgo.NewClient(` in a module where no non-test file calls `kgo.ClientID(`. A settings test asserts that `validate` refuses an empty `client_id`. In review, check that the ID names the service, not a pod or a random value.
