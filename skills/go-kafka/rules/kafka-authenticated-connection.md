---
title: Always log in with SASL; TLS is optional, PLAIN only over it
impact: CRITICAL
tags: kafka, security, sasl, tls, settings
check: scan (candidates), test, review
---

## Always log in with SASL; TLS is optional, PLAIN only over it

**Impact: CRITICAL** (an anonymous client means the broker accepts anonymous clients: anyone who reaches it can read every topic and write fake events; a password sent with PLAIN over plain TCP can be read off the network)

Every client logs in, in every environment: SASL is required, and the settings check refuses a missing mechanism, username or password at startup instead of connecting anonymously. Local and CI brokers run with SASL too (`kfake.EnableSASL()` with a `kfake.Superuser`, or a broker container with a SASL listener), so the login path is the one under test. TLS is optional (a private network or a mesh that already encrypts); without it the mechanism must be SCRAM-SHA-512 or SCRAM-SHA-256, which never sends the password, while PLAIN and OAUTHBEARER send the secret as it is and are refused unless `tls` is on.

**Incorrect:**

```go
// Login is skipped when the settings leave the mechanism empty.
if cfg.SASL.Mechanism != "" {
	m, err := cfg.SASL.mechanism()
	if err != nil {
		return nil, fmt.Errorf("kafka sasl: %w", err)
	}
	opts = append(opts, kgo.SASL(m))
}
```

**Correct:**

```go
// In the config package's validate, which runs when the settings load (references/config.md):
// no client is built without a login.
switch {
case k.SASL.Mechanism == "":
	return fail("sasl.mechanism is required: every client logs in (SCRAM-SHA-512, SCRAM-SHA-256, PLAIN)")
case !slices.Contains(kafkaMechanisms, k.SASL.Mechanism):
	return fail("sasl.mechanism %q: want one of SCRAM-SHA-512, SCRAM-SHA-256, PLAIN", k.SASL.Mechanism)
case k.SASL.Mechanism == "PLAIN" && !k.TLS.Enabled:
	return fail("sasl.mechanism PLAIN sends the password in clear: set kafka.tls.enabled or use SCRAM-SHA-512")
case k.SASL.Username == "":
	return fail("sasl.username is required")
case (k.SASL.Password == "") == (k.SASL.PasswordFile == ""):
	return fail("sasl.password and sasl.password_file are alternatives: set one")
}

// baseOpts always logs in.
mech, err := mechanism(cfg.SASL) // reads password_file
if err != nil {
	return nil, fmt.Errorf("kafka sasl: %w", err)
}
opts := []kgo.Opt{kgo.SeedBrokers(cfg.Brokers...), kgo.ClientID(cfg.ClientID), kgo.SASL(mech)}
```

The client can only do its half. The broker must refuse anonymous clients itself: no `PLAINTEXT` listener reachable by services, an authorizer on, `allow.everyone.if.no.acl.found=false`, and ACLs per service principal (Write on its topics, Read on the topics and the group it consumes).

**How to check:** `scripts/scan.sh` flags every `kgo.NewClient(` in a module where no non-test file calls `kgo.SASL(`, and a `Mechanism != ""` / `Mechanism == ""` test that makes login optional. A settings test asserts that `validate` refuses an empty mechanism and PLAIN without TLS. In review, confirm the broker side with whoever runs it.
