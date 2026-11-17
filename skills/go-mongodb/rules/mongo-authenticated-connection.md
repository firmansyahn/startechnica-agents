---
title: Always log in; TLS is optional, PLAIN only over it
impact: CRITICAL
tags: mongodb, security, authentication, tls, settings
check: scan (candidates), test, review
---

## Always log in; TLS is optional, PLAIN only over it

**Impact: CRITICAL** (a client that connects without credentials works only against a server with authorization off, where anyone who reaches it can read and change every database; a password sent with PLAIN over plain TCP can be read off the network)

Every client logs in, in every environment: the credentials come from the settings' `auth` block or from the URI (then a secret, through `uri_file`), never both and never neither, and the store refuses to build a client whose options carry no login. Local and CI servers run with authorization on too (testcontainers' `WithUsername`/`WithPassword`), so the login path is the one under test. TLS is optional; without it the mechanism must be SCRAM (SCRAM-SHA-256, negotiated when the mechanism is empty), which never sends the password, while PLAIN (LDAP) is refused unless TLS is on. MONGODB-X509, MONGODB-AWS and MONGODB-OIDC log in without a password.

**Incorrect:**

```go
// Works only because the server lets anyone in; no check that the URI holds a login.
client, err := mongo.Connect(options.Client().ApplyURI("mongodb://db-0.example.com:27017/?replicaSet=rs0"))
```

**Correct:**

```go
opts := options.Client().ApplyURI(uri) // uri from the settings, or read from uri_file
if err := opts.Validate(); err != nil {
	return nil, fmt.Errorf("mongodb: %w", err)
}
if cfg.Auth.Set() { // the auth block, when the URI holds no credentials
	cred, err := credential(cfg.Auth) // reads password_file
	if err != nil {
		return nil, err
	}
	opts.SetAuth(cred)
}
if err := checkLogin(opts); err != nil {
	return nil, err
}

// checkLogin refuses options that would connect anonymously or send a password in clear.
func checkLogin(opts *options.ClientOptions) error {
	a := opts.Auth
	if a == nil {
		return errors.New("mongodb: no credentials: every client logs in (set mongodb.auth, or put them in the URI)")
	}
	switch a.AuthMechanism {
	case "MONGODB-X509", "MONGODB-AWS", "MONGODB-OIDC", "GSSAPI":
		return nil // a certificate, an AWS role, a token or a Kerberos ticket
	case "PLAIN":
		if opts.TLSConfig == nil {
			return errors.New("mongodb: PLAIN sends the password in clear: turn TLS on (tls=true) or use SCRAM-SHA-256")
		}
	}
	if a.Username == "" {
		return errors.New("mongodb: the credentials have no username")
	}
	return nil
}
```

The client can only do its half. The server enforces it: `security.authorization: enabled` (always on in Atlas), no anonymous access, and one user per service with the least role that works, `readWrite` on the service's own database, never `root` or an `*AnyDatabase` role.

**How to check:** `scripts/scan.sh` flags a `mongo.Connect` in a module where nothing calls `SetAuth(` or a login check, and a literal `mongodb://` or `mongodb+srv://` URI in non-test code (a URI belongs in the settings: a literal one either has no login or embeds a password). A test of the store's options asserts that an anonymous URI and PLAIN without TLS are refused. In review, confirm the server side with whoever runs it.
