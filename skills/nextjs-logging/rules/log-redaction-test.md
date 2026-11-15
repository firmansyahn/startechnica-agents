---
title: A test proves the redaction
impact: HIGH
tags: redaction
check: scan, review
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

**How to check:** `scripts/scan.sh` flags the pino logger module when it exports neither `REDACT` nor `createLogger`, and when no `*.test.ts`/`*.test.tsx` in the app uses `REDACT` or `createLogger(` together with `not.toMatch`/`not.toContain`. It proves a redaction test exists, not what it covers: review that it logs credentials at every depth the app uses.
