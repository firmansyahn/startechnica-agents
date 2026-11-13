---
title: Fix the clock where time shows
impact: LOW
tags: stability
check: review
---

## Fix the clock where time shows

**Impact: LOW**

Dates, relative times ("3 minutes ago"), greetings and expiry banners change with the clock. Set it before `goto`.

**Correct:**

```ts
await page.clock.setFixedTime(new Date("2026-01-15T10:00:00Z"));
await page.goto("/app/items");
```

Set `timezoneId` and `locale` in the config so formatting matches on every machine.
