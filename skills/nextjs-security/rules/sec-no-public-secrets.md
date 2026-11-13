---
title: Never put a secret in NEXT_PUBLIC_ variables or next.config env
impact: CRITICAL
tags: env, secrets, bundle
check: scan
---

## Never put a secret in NEXT_PUBLIC_ variables or next.config env

**Impact: CRITICAL** (the secret is published to every visitor and frozen into the image)

`NEXT_PUBLIC_*` variables and `next.config` `env` entries are inlined into the browser bundle at build time. Secrets (API keys, client secrets, signing keys, passwords, tokens) are read on the server, per request, from a server-only config module.

**Incorrect:**

```bash
NEXT_PUBLIC_PAYMENTS_SECRET_KEY=sk_live_...
```

```ts
const nextConfig = { env: { API_KEY: process.env.API_KEY } };
```

**Correct:**

```bash
PAYMENTS_SECRET_KEY=...                       # server only, read in src/api/config.ts
NEXT_PUBLIC_PAYMENTS_PUBLISHABLE_KEY=pk_...   # meant to be public
```

**How to check:** `scripts/scan.sh` flags `NEXT_PUBLIC_` names containing SECRET, TOKEN, PASSWORD, PRIVATE or KEY (publishable keys are confirmed by hand) and any `env:` block in `next.config.*`. In review, check every new `NEXT_PUBLIC_` variable is meant to be public.
