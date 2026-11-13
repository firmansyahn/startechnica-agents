---
title: Never turn off TLS certificate verification
impact: CRITICAL
tags: security, tls, http-client
check: scan, lint (gosec G402)
---

## Never turn off TLS certificate verification

**Impact: CRITICAL** (anyone on the network path can read and change the traffic, credentials included)

`InsecureSkipVerify: true` accepts any certificate. A peer with a private CA gets that CA added to `RootCAs`; a self-signed peer gets its certificate pinned. If a device truly can't be verified, the setting is per peer, off by default, named as insecure in config, and logged when used.

**Incorrect:**

```go
client := &http.Client{Transport: &http.Transport{
	TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
}}
```

**Correct:**

```go
pool := x509.NewCertPool()
if !pool.AppendCertsFromPEM(caPEM) {
	return nil, errors.New("vendor CA: no certificates")
}
client := &http.Client{
	Timeout:   10 * time.Second,
	Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS12}},
}
```

**How to check:** `scripts/scan.sh` flags `InsecureSkipVerify: true`. A hit behind an explicit per-peer "insecure" setting that defaults to off and is logged is acceptable; note it rather than report it.
