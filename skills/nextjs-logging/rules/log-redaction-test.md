---
title: A test proves the redaction
impact: HIGH
tags: redaction
check: review
---

## A test proves the redaction

**Impact: HIGH**

A unit test logs an object with credentials at the depths the app uses, through the real `REDACT` list (exported) or a `createLogger(stream)` factory, and expects none of the values in the output.

**Correct:**

```ts
const lines: string[] = [];
const log = pino({ redact: { paths: REDACT, censor: "[redacted]" } }, { write: (l: string) => lines.push(l) });
log.info({ req: { headers: { authorization: "Bearer abc", cookie: "s=1" } }, body: { password: "p" } }, "x");
expect(lines.join("")).not.toMatch(/abc|s=1|"p"/);
```
