---
title: Check user-supplied URLs before the server calls them
impact: HIGH
tags: security, ssrf, http-client, webhooks
check: review
---

## Check user-supplied URLs before the server calls them

**Impact: HIGH** (server-side request forgery: a webhook or "fetch this URL" setting reaches cloud metadata, admin ports or internal services)

When a URL comes from a user or tenant (webhooks, callback URLs, image or feed fetches, integration endpoints), parse it, require `https` (or an allowed scheme), and refuse hosts that resolve to loopback, private, link-local or metadata addresses. Check the address at **dial time** (a `net.Dialer.Control` func), not only when the setting is saved, because DNS can change; and don't follow redirects to unchecked hosts.

**Incorrect:**

```go
resp, err := h.client.Post(tenant.WebhookURL, "application/json", body)
```

**Correct:**

```go
dialer := &net.Dialer{Timeout: 5 * time.Second, Control: func(_, address string, _ syscall.RawConn) error {
	host, _, _ := net.SplitHostPort(address)
	ip, err := netip.ParseAddr(host)
	if err != nil || !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
		return fmt.Errorf("address %s not allowed", host)
	}
	return nil
}}
webhookClient := &http.Client{
	Timeout:       10 * time.Second,
	Transport:     &http.Transport{DialContext: dialer.DialContext},
	CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
}
```

**How to check:** in review, for every outbound call find where its URL comes from. A URL from configuration the operator controls is fine; one a user, tenant or stored record supplies needs the checked client. A project with an egress policy or a shared "safe client" should use it.
