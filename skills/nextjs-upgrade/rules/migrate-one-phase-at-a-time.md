---
title: One area per merge request, the app green after each
impact: MEDIUM
tags: migrate, phases
check: review
---

## One area per merge request, the app green after each

**Impact: MEDIUM** (a migration that changes data, forms and UI at once can't be reverted in part, and a half-done area blocks every other)

Each phase in [references/migrate-mode.md](../references/migrate-mode.md) is one area (data, forms, UI, strings...), in the listed order. It is one merge request, or several split by route or domain. After each, the app passes a frozen install, typecheck, lint, tests and build, and serves the baseline's routes. The next phase starts once the previous one is merged.

**Incorrect:**

```text
refactor(web): move to tanstack query, react-hook-form, shadcn and next-intl
```

**Correct:**

```text
refactor(web): read customers through tanstack query
refactor(web): read orders through tanstack query
refactor(web): move the customer form to react-hook-form and zod
```

**How to check:** each merge request of the migration names one phase from the map, and its pipeline is green.
