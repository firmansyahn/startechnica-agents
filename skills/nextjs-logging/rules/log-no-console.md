---
title: Log through the logger, not console
impact: MEDIUM
tags: logging, eslint
check: eslint
---

## Log through the logger, not console

**Impact: MEDIUM** (unstructured lines without request ids or redaction; debug output shipped to users' consoles)

Server code logs through the shared pino logger (`requestLogger()` in handlers and actions). Browser code reports errors through the error reporter, and doesn't log to the console in production.

**Incorrect:**

```ts
console.log("saving item", input);
console.error(err);
```

**Correct:**

```ts
const log = await requestLogger({ action: "saveItem" });
log.warn({ err, status: res.status }, "backend refused write");
```

**How to check:** `assets/eslint.config.mjs` (`no-console: "error"` for `app/`, `components/` and `src/`; off in `scripts/`, `tests/`, test files and config files); `scripts/scan.sh` lists `console.` calls.
