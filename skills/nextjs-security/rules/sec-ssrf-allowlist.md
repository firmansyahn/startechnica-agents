---
title: Allow-list server fetches to user-supplied URLs
impact: HIGH
tags: ssrf, fetch, webhooks
check: review
---

## Allow-list server fetches to user-supplied URLs

**Impact: HIGH** (the server fetches internal services or cloud metadata for the attacker)

Webhook targets, link previews, URL imports and remote images: only `https` to allow-listed hosts, no redirects followed, private, loopback and metadata addresses refused after DNS resolution, a timeout and a size cap, and no user cookies or tokens forwarded. `images.remotePatterns` lists exact hosts, never `**`.

**Incorrect:**

```ts
const res = await fetch(input.url);                     // http://169.254.169.254/... works
```

**Correct:**

```ts
const url = allowedUrl(input.url);                      // throws unless https and an allow-listed host
const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(5_000) });
```

**How to check:** in review, any server-side `fetch` whose URL comes from input, a stored setting or a reply. `grep -rn 'remotePatterns' next.config.*` for wildcard hosts.
