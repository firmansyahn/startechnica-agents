---
title: Never log credentials, bodies or personal data
impact: HIGH
tags: logging, security, privacy
check: test
---

## Never log credentials, bodies or personal data

**Impact: HIGH** (tokens and passwords in the log store, readable by everyone with log access)

The logger redacts `authorization`, `cookie`, `set-cookie`, `password`, `secret`, `token`, `access`, `refresh`, `code` and `client_secret`. On top of that, code never logs request or reply bodies, form inputs, full headers or query strings, and logs ids instead of personal data.

**Incorrect:**

```ts
log.info({ headers: Object.fromEntries(req.headers), body }, `callback ${req.url}`);
```

**Correct:**

```ts
log.info({ "url.path": new URL(req.url).pathname, "http.response.status_code": res.status }, "oauth callback");
```

**How to check:** a test logs a sample object with credentials through the real logger configuration and asserts none appear; review new log calls for `body`, `headers`, `req.url` and `input`.
